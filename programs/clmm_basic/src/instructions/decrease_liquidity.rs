use anchor_lang::{prelude::*, system_program};
use std::cell::RefMut;
use crate::PoolState;
use crate::errors::ClmmError;
use crate::instructions::add_liquidity::{LiquidityChangeResult, modify_position};
use crate::states::tick_array::TickArrayState;
use crate::util::token::transfer_from_pool_vault_to_user;
use anchor_spl::token_interface;
use anchor_spl::token::{Token, TokenAccount};
use anchor_spl::token_2022::{self, spl_token_2022::instruction::AuthorityType, Token2022};

#[derive(Accounts)]
pub struct DecreaseLiquidity<'info> {
    #[account(mut)]
    pub pool_state: AccountLoader<'info, PoolState>,

    /// Token_0 vault
    #[account(
        mut,
        constraint = token_vault_0.key() == pool_state.load()?.token_vault_0
    )]
    pub token_vault_0: Box<Account<'info, TokenAccount>>,

    /// Token_1 vault
    #[account(
        mut,
        constraint = token_vault_1.key() == pool_state.load()?.token_vault_1
    )]
    pub token_vault_1: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = tick_array_lower.load()?.pool_id == pool_state.key()
    )]
    pub tick_array_lower: AccountLoader<'info, TickArrayState>,

    #[account(
        mut,
        constraint = tick_array_upper.load()?.pool_id == pool_state.key()
    )]
    pub tick_array_upper: AccountLoader<'info, TickArrayState>,

    #[account(
        mut,
        token::mint = token_vault_0.mint
    )]
    pub recipient_token_account_0: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        token::mint = token_vault_1.mint
    )]
    pub recipient_token_account_1: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
}

pub fn decrease_liquidity<'a, 'b, 'c: 'info, 'info>(
    pool_state_loader: &'b AccountLoader<'info, PoolState>,
    token_vault_0: &'b AccountInfo<'info>,
    token_vault_1: &'b AccountInfo<'info>,
    tick_array_lower_loader: &'b AccountLoader<'info, TickArrayState>,
    tick_array_upper_loader: &'b AccountLoader<'info, TickArrayState>,
    recipient_token_account_0: &'b AccountInfo<'info>,
    recipient_token_account_1: &'b AccountInfo<'info>,
    token_program: &'b Program<'info, Token>,
    token_program_2022: Option<&'b Program<'info, Token2022>>,
    vault_0_mint: Option<Box<InterfaceAccount<'info, token_interface::Mint>>>,
    vault_1_mint: Option<Box<InterfaceAccount<'info, token_interface::Mint>>>,
    liquidity: u128,
    amount_0_min: u64,
    amount_1_min: u64,
    tick_lower_index: i32,
    tick_upper_index: i32,
) -> Result<()> {
    let mut pool_state = pool_state_loader.load_mut()?;

    let LiquidityChangeResult {
        amount_0,
        amount_1,
        ..
    } = burn_liquidity(
        pool_state_loader,
        &mut pool_state,
        tick_array_lower_loader,
        tick_array_upper_loader,
        tick_lower_index,
        tick_upper_index,
        liquidity,
    )?;

    let decrease_amount_0 = amount_0;
    let decrease_amount_1 = amount_1;

    if liquidity > 0 {
        require_gte!(
            decrease_amount_0,
            amount_0_min,
            ClmmError::SlippageCheck
        );
        require_gte!(
            decrease_amount_1,
            amount_1_min,
            ClmmError::SlippageCheck
        );
    }


    let mut token_2022_program_opt: Option<AccountInfo> = None;
    if token_program_2022.is_some() {
        token_2022_program_opt = Some(token_program_2022.clone().unwrap().to_account_info());
    }

    transfer_from_pool_vault_to_user(
        pool_state_loader,
        &token_vault_0.to_account_info(),
        recipient_token_account_0,
        vault_0_mint,
        token_program,
        token_2022_program_opt.clone(),
        decrease_amount_0,
    )?;

    transfer_from_pool_vault_to_user(
        pool_state_loader,
        &token_vault_1.to_account_info(),
        recipient_token_account_1,
        vault_1_mint,
        token_program,
        token_2022_program_opt.clone(),
        decrease_amount_1,
    )?;

    Ok(())
}

pub fn burn_liquidity<'b, 'c: 'info, 'info> (
    pool_state_loader: &'b AccountLoader<'info, PoolState>,
    pool_state: &mut RefMut<PoolState>,
    tick_array_lower_loader: &AccountLoader<'info, TickArrayState>,
    tick_array_upper_loader: &AccountLoader<'info, TickArrayState>,
    tick_lower_index: i32,
    tick_upper_index: i32,
    liquidity: u128,
) -> Result<LiquidityChangeResult> {
    require_keys_eq!(tick_array_lower_loader.load()?.pool_id, pool_state_loader.key());
    require_keys_eq!(tick_array_upper_loader.load()?.pool_id, pool_state_loader.key());
    let liquidity_before = pool_state.liquidity;

    // get tick_state
    let mut tick_lower_state = *tick_array_lower_loader
        .load_mut()?
        .get_tick_state_mut(tick_lower_index, pool_state.tick_spacing)?;

    let mut tick_upper_state = *tick_array_upper_loader
        .load_mut()?
        .get_tick_state_mut(tick_upper_index, pool_state.tick_spacing)?;
    
    let clock = Clock::get()?;
    let result = modify_position(
        -i128::try_from(liquidity).unwrap(),
        pool_state,
        &mut tick_lower_state,
        &mut tick_upper_state,
        clock.unix_timestamp as u64,
    )?;

    // update tick_state
    tick_array_lower_loader.load_mut()?.update_tick_state(
        tick_lower_index,
        pool_state.tick_spacing,
        tick_lower_state,
    )?;

    tick_array_upper_loader.load_mut()?.update_tick_state(
        tick_upper_index,
        pool_state.tick_spacing,
        tick_upper_state,
    )?;

    if result.tick_lower_flipped {
        let mut tick_array_lower = tick_array_lower_loader.load_mut()?;
        tick_array_lower.update_initialized_tick_count(false)?;
    }

    if result.tick_upper_flipped {
        let mut tick_array_upper = tick_array_upper_loader.load_mut()?;
        tick_array_upper.update_initialized_tick_count(false)?;
    }

    Ok(result)
}