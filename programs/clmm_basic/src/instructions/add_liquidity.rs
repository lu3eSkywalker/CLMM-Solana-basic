use crate::errors::ClmmError;
use crate::libraries::liquidity_math::add_delta;
use crate::libraries::liquidity_math::get_delta_amounts_signed;
use crate::states::tick_array::TickArrayState;
use crate::states::tick_array::TickState;
use crate::states::*;
use crate::util::account_load::AccountLoad;
use crate::util::token::transfer_from_user_to_pool_vault;
use crate::PoolState;
use anchor_lang::{prelude::*, system_program};
use anchor_spl::token::{Mint, Token, TokenAccount};
use anchor_spl::token_2022::{self, spl_token_2022::instruction::AuthorityType, Token2022};
use anchor_spl::token_interface;
use std::cell::RefMut;

#[derive(Default)]
pub struct LiquidityChangeResult {
    pub amount_0: u64,
    pub amount_1: u64,
    pub tick_lower_flipped: bool,
    pub tick_upper_flipped: bool,
}

/// Add liquidity to an initialized pool
pub fn add_liquidity<'b, 'c: 'info, 'info>(
    payer: &'b Signer<'info>,
    token_account_0: &'b AccountInfo<'info>,
    token_account_1: &'b AccountInfo<'info>,
    token_vault_0: &'b AccountInfo<'info>,
    token_vault_1: &'b AccountInfo<'info>,
    tick_array_lower_loader: &'b AccountLoad<'info, TickArrayState>,
    tick_array_upper_loader: &'b AccountLoad<'info, TickArrayState>,
    token_program_2022: Option<&Program<'info, Token2022>>,
    token_program: &'b Program<'info, Token>,
    vault_0_mint: Option<Box<InterfaceAccount<'info, token_interface::Mint>>>,
    vault_1_mint: Option<Box<InterfaceAccount<'info, token_interface::Mint>>>,
    pool_state: &mut RefMut<PoolState>,
    liquidity: &mut u128,
    amount_0_max: u64,
    amount_1_max: u64,
    tick_lower_index: i32,
    tick_upper_index: i32,
) -> Result<LiquidityChangeResult> {
    require!(*liquidity > 0, ClmmError::InvalidLiquidity);

    require!(amount_0_max > 0, ClmmError::ZeroToken0Amount);
    require!(amount_1_max > 0, ClmmError::ZeroToken1Amount);

    let liquidity_before = pool_state.liquidity;
    // require_keys_eq!(tick_array_lower_loader.load()?.pool_id, pool_state.key());
    // require_keys_eq!(tick_array_upper_loader.load()?.pool_id, pool_state.key());

    // get tick state
    let mut tick_lower_state = *tick_array_lower_loader
        .load_mut()?
        .get_tick_state_mut(tick_lower_index, pool_state.tick_spacing)?;

    let mut tick_upper_state = *tick_array_upper_loader
        .load_mut()?
        .get_tick_state_mut(tick_upper_index, pool_state.tick_spacing)?;

    if tick_lower_state.tick == 0 {
        tick_lower_state.tick = tick_lower_index;
    }
    if tick_upper_state.tick == 0 {
        tick_upper_state.tick = tick_upper_index;
    }
    let clock = Clock::get()?;
    let mut result = modify_position(
        i128::try_from(*liquidity).unwrap(),
        pool_state,
        &mut tick_lower_state,
        &mut tick_upper_state,
        clock.unix_timestamp as u64,
    )?;

    if result.tick_lower_flipped {
        tick_array_lower_loader
            .load_mut()?
            .update_initialized_tick_count(true)?;
    }

    if result.tick_upper_flipped {
        tick_array_upper_loader
            .load_mut()?
            .update_initialized_tick_count(true)?;
    }

    let amount_0 = result.amount_0;
    let amount_1 = result.amount_1;

    require!(amount_0 > 0 || amount_1 > 0, ClmmError::ZeroSupplyLiquidity);

    require_gte!(amount_0_max, amount_0, ClmmError::SlippageCheck);

    require_gte!(amount_1_max, amount_1, ClmmError::SlippageCheck);

    let mut token_2022_program_opt: Option<AccountInfo> = None;
    if token_program_2022.is_some() {
        token_2022_program_opt = Some(token_program_2022.clone().unwrap().to_account_info());
    }

    transfer_from_user_to_pool_vault(
        payer,
        token_account_0,
        token_vault_0,
        vault_0_mint,
        &token_program,
        token_2022_program_opt.clone(),
        amount_0,
    )?;

    transfer_from_user_to_pool_vault(
        payer,
        token_account_1,
        token_vault_1,
        vault_1_mint,
        &token_program,
        token_2022_program_opt.clone(),
        amount_1,
    )?;

    Ok(result)
}

pub fn modify_position(
    liquidity_delta: i128,
    pool_state: &mut RefMut<PoolState>,
    tick_lower_state: &mut TickState,
    tick_upper_state: &mut TickState,
    timestamp: u64,
) -> Result<LiquidityChangeResult> {
    let mut flipped_lower = false;
    let mut flipped_upper = false;

    // update the ticks if liquidity delta is non-zero
    if liquidity_delta != 0 {
        // Update tick state and find if tick is flipped
        flipped_lower = tick_lower_state.update(pool_state.current_tick, liquidity_delta, false)?;
        flipped_upper = tick_upper_state.update(pool_state.current_tick, liquidity_delta, true)?;
    }

    // Clear Unused ticks
    if liquidity_delta < 0 {
        if tick_lower_state.liquidity_gross == 0 {
            tick_lower_state.clear();
        }
        if tick_upper_state.liquidity_gross == 0 {
            tick_upper_state.clear();
        }
    }

    let mut amount_0 = 0;
    let mut amount_1 = 0;

    // Compute Token Deltas

    if liquidity_delta != 0 {
        (amount_0, amount_1) = get_delta_amounts_signed(
            pool_state.current_tick,
            pool_state.sqrt_price_x64,
            tick_lower_state.tick,
            tick_upper_state.tick,
            liquidity_delta,
        )?;
        if pool_state.current_tick >= tick_lower_state.tick
            && pool_state.current_tick < tick_upper_state.tick
        {
            pool_state.liquidity = add_delta(pool_state.liquidity, liquidity_delta)?;
        }
    }

    Ok(LiquidityChangeResult {
        amount_0: amount_0,
        amount_1: amount_1,
        tick_lower_flipped: flipped_lower,
        tick_upper_flipped: flipped_upper,
    })
}
