use crate::errors::ClmmError;
use crate::libraries::liquidity_math::add_delta;
use crate::libraries::swap_math::compute_swap_step;
use crate::libraries::tick_math::{self, get_sqrt_price_at_tick, get_tick_at_sqrt_price};
use crate::states::tick_array::TickArrayState;
use crate::util::token::{transfer_from_pool_vault_to_user, transfer_from_user_to_pool_vault};
use crate::PoolState;
use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};
use std::cell::RefMut;

#[derive(Accounts)]
pub struct Swap<'info> {
    pub payer: Signer<'info>,

    #[account(mut)]
    pub pool_state: AccountLoader<'info, PoolState>,

    #[account(mut)]
    pub input_token_account: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub output_token_account: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub input_vault: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub output_vault: Box<Account<'info, TokenAccount>>,

    #[account(mut, constraint = tick_array.load()?.pool_id == pool_state.key())]
    pub tick_array: AccountLoader<'info, TickArrayState>,

    pub token_program: Program<'info, Token>,
}

#[derive(Debug)]
struct SwapState {
    amount_specified_remaining: u64,
    amount_calculated: u64,
    sqrt_price_x64: u128,
    tick: i32,
    liquidity: u128,
}

#[derive(Default)]
struct StepComputations {
    sqrt_price_start_x64: u128,
    tick_next: i32,
    initialized: bool,
    sqrt_price_next_x64: u128,
    amount_in: u64,
    amount_out: u64,
}

pub fn swap_internal(
    pool_state: &mut RefMut<PoolState>,
    tick_array: &mut RefMut<TickArrayState>,
    amount_specified: u64,
    sqrt_price_limit_x64: u128,
    zero_for_one: bool,
    is_base_input: bool,
) -> Result<(u64, u64)> {
    require!(amount_specified != 0, ClmmError::InvalidLiquidity);

    require!(
        if zero_for_one {
            sqrt_price_limit_x64 < pool_state.sqrt_price_x64
                && sqrt_price_limit_x64 > tick_math::MIN_SQRT_PRICE_X64
        } else {
            sqrt_price_limit_x64 > pool_state.sqrt_price_x64
                && sqrt_price_limit_x64 < tick_math::MAX_SQRT_PRICE_X64
        },
        ClmmError::SlippageCheck
    );

    let mut state = SwapState {
        amount_specified_remaining: amount_specified,
        amount_calculated: 0,
        sqrt_price_x64: pool_state.sqrt_price_x64,
        tick: pool_state.current_tick,
        liquidity: pool_state.liquidity,
    };

    let block_timestamp = Clock::get()?.unix_timestamp as u32;

    while state.amount_specified_remaining != 0 && state.sqrt_price_x64 != sqrt_price_limit_x64 {
        let mut step = StepComputations::default();
        step.sqrt_price_start_x64 = state.sqrt_price_x64;

        let next_initialized = tick_array.next_initialized_tick(
            state.tick,
            pool_state.tick_spacing,
            zero_for_one,
        )?;

        if let Some(tick_state) = next_initialized {
            step.tick_next = tick_state.tick;
            step.initialized = true;
        } else {
            step.tick_next = if zero_for_one {
                tick_math::MIN_TICK
            } else {
                tick_math::MAX_TICK
            };
            step.initialized = false;
        }

        if step.tick_next < tick_math::MIN_TICK {
            step.tick_next = tick_math::MIN_TICK;
        } else if step.tick_next > tick_math::MAX_TICK {
            step.tick_next = tick_math::MAX_TICK;
        }
        step.sqrt_price_next_x64 = get_sqrt_price_at_tick(step.tick_next)?;

        let target_price = if (zero_for_one && step.sqrt_price_next_x64 < sqrt_price_limit_x64)
            || (!zero_for_one && step.sqrt_price_next_x64 > sqrt_price_limit_x64)
        {
            sqrt_price_limit_x64
        } else {
            step.sqrt_price_next_x64
        };

        let swap_step = compute_swap_step(
            step.sqrt_price_start_x64,
            target_price,
            state.liquidity,
            state.amount_specified_remaining,
            is_base_input,
            zero_for_one,
            block_timestamp,
        )?;

        state.sqrt_price_x64 = swap_step.sqrt_price_next_x64;
        step.amount_in = swap_step.amount_in;
        step.amount_out = swap_step.amount_out;

        if is_base_input {
            state.amount_specified_remaining = state
                .amount_specified_remaining
                .checked_sub(step.amount_in)
                .unwrap();
            state.amount_calculated = state
                .amount_calculated
                .checked_add(step.amount_out)
                .unwrap();
        } else {
            state.amount_specified_remaining = state
                .amount_specified_remaining
                .checked_sub(step.amount_out)
                .unwrap();
            state.amount_calculated = state
                .amount_calculated
                .checked_add(step.amount_in)
                .unwrap();
        }

        if state.sqrt_price_x64 == step.sqrt_price_next_x64 && step.initialized {
            let tick_state = tick_array.get_tick_state_mut(step.tick_next, pool_state.tick_spacing)?;
            let mut liquidity_net = tick_state.liquidity_net;
            if zero_for_one {
                liquidity_net = -liquidity_net;
            }
            state.liquidity = add_delta(state.liquidity, liquidity_net)?;

            state.tick = if zero_for_one {
                step.tick_next - 1
            } else {
                step.tick_next
            };
        } else if state.sqrt_price_x64 != step.sqrt_price_start_x64 {
            state.tick = get_tick_at_sqrt_price(state.sqrt_price_x64)?;
        }
    }

    pool_state.sqrt_price_x64 = state.sqrt_price_x64;
    pool_state.current_tick = state.tick;
    pool_state.liquidity = state.liquidity;

    let (amount_0, amount_1) = if zero_for_one == is_base_input {
        (
            amount_specified
                .checked_sub(state.amount_specified_remaining)
                .unwrap(),
            state.amount_calculated,
        )
    } else {
        (
            state.amount_calculated,
            amount_specified
                .checked_sub(state.amount_specified_remaining)
                .unwrap(),
        )
    };

    Ok((amount_0, amount_1))
}
pub fn swap<'a, 'b, 'c: 'info, 'info>(
    ctx: Context<'a, 'b, 'c, 'info, Swap<'info>>,
    amount: u64,
    other_amount_threshold: u64,
    sqrt_price_limit_x64: u128,
    is_base_input: bool,
) -> Result<()> {
    let amount_0;
    let amount_1;
    let zero_for_one;

    let input_balance_before = ctx.accounts.input_vault.amount;
    let output_balance_before = ctx.accounts.output_vault.amount;

    {
        let pool_state = &mut ctx.accounts.pool_state.load_mut()?;
        zero_for_one = ctx.accounts.input_vault.mint == pool_state.token_mint_0;

        require!(
            if zero_for_one {
                ctx.accounts.input_vault.key() == pool_state.token_vault_0
                    && ctx.accounts.output_vault.key() == pool_state.token_vault_1
            } else {
                ctx.accounts.input_vault.key() == pool_state.token_vault_1
                    && ctx.accounts.output_vault.key() == pool_state.token_vault_0
            },
            ClmmError::InvalidVault
        );

        let tick_array = &mut ctx.accounts.tick_array.load_mut()?;

        let limit = if sqrt_price_limit_x64 == 0 {
            if zero_for_one {
                tick_math::MIN_SQRT_PRICE_X64 + 1
            } else {
                tick_math::MAX_SQRT_PRICE_X64 - 1
            }
        } else {
            sqrt_price_limit_x64
        };

        (amount_0, amount_1) = swap_internal(
            pool_state,
            tick_array,
            amount,
            limit,
            zero_for_one,
            is_base_input,
        )?;

        require!(amount_0 != 0 && amount_1 != 0, ClmmError::ZeroSupplyLiquidity);
    }

    if zero_for_one {
        transfer_from_user_to_pool_vault(
            &ctx.accounts.payer.to_account_info(),
            &ctx.accounts.input_token_account.to_account_info(),
            &ctx.accounts.input_vault.to_account_info(),
            None,
            &ctx.accounts.token_program.to_account_info(),
            None,
            amount_0,
        )?;

        transfer_from_pool_vault_to_user(
            &ctx.accounts.pool_state,
            &ctx.accounts.output_vault.to_account_info(),
            &ctx.accounts.output_token_account.to_account_info(),
            None,
            &ctx.accounts.token_program.to_account_info(),
            None,
            amount_1,
        )?;
    } else {
        transfer_from_user_to_pool_vault(
            &ctx.accounts.payer.to_account_info(),
            &ctx.accounts.input_token_account.to_account_info(),
            &ctx.accounts.input_vault.to_account_info(),
            None,
            &ctx.accounts.token_program.to_account_info(),
            None,
            amount_1,
        )?;

        transfer_from_pool_vault_to_user(
            &ctx.accounts.pool_state,
            &ctx.accounts.output_vault.to_account_info(),
            &ctx.accounts.output_token_account.to_account_info(),
            None,
            &ctx.accounts.token_program.to_account_info(),
            None,
            amount_0,
        )?;
    }

    if is_base_input {
        let output_amount = output_balance_before
            .checked_sub(ctx.accounts.output_vault.amount)
            .unwrap();
        require!(
            output_amount >= other_amount_threshold,
            ClmmError::SlippageCheck
        );
    } else {
        let input_amount = ctx
            .accounts
            .input_vault
            .amount
            .checked_sub(input_balance_before)
            .unwrap();
        require!(
            input_amount <= other_amount_threshold,
            ClmmError::SlippageCheck
        );
    }

    Ok(())
}
