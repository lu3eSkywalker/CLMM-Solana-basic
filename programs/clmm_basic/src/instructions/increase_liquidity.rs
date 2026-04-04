use anchor_lang::{prelude::*, system_program};
use crate::PoolState;
use crate::errors::ClmmError;
use crate::states::*;
use crate::instructions::*;
use crate::util::*;
use crate::states::tick_array::TickArrayState;
use anchor_spl::token_interface;
use anchor_spl::token_interface::Mint;
use anchor_spl::token::{Token, TokenAccount};
use anchor_spl::token_2022::{self, spl_token_2022::instruction::AuthorityType, Token2022};

#[derive(Accounts)]
pub struct IncreaseLiquidity<'info> {

    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(mut)]
    pub pool_state: AccountLoader<'info, PoolState>,

    #[account(mut, constraint = tick_array_lower.load()?.pool_id == pool_state.key())]
    pub tick_array_lower: AccountLoader<'info, TickArrayState>,

    #[account(mut, constraint = tick_array_upper.load()?.pool_id == pool_state.key())]
    pub tick_array_upper: AccountLoader<'info, TickArrayState>,

    /// Payer's token account for token_0
    #[account(
        mut,
        token::mint = token_vault_0.mint
    )]
    pub token_account_0: Box<Account<'info, TokenAccount>>,

    /// Payer's token account for token_1
    #[account(
        mut,
        token::mint = token_vault_1.mint
    )]
    pub token_account_1: Box<Account<'info, TokenAccount>>,


    /// Address which holds pool tokens for token_0
    #[account(
        mut,
        constraint = token_vault_0.key() == pool_state.load()?.token_vault_0
    )]
    pub token_vault_0: Box<Account<'info, TokenAccount>>,

    /// Address which holds pool tokens for token_1
    #[account(
        mut,
        constraint = token_vault_1.key() == pool_state.load()?.token_vault_1
    )]
    pub token_vault_1: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
}

pub fn increase_liquidity_v1<'a, 'b, 'c: 'info, 'info>(
    ctx: Context<'a, 'b, 'c, 'info, IncreaseLiquidity<'info>>,
    liquidity: u128,
    amount_0_max: u64,
    amount_1_max: u64,
    tick_lower_index: i32,
    tick_upper_index: i32,
) -> Result<()> {
    increase_liquidity(
        &ctx.accounts.payer,
        &ctx.accounts.pool_state,
        &ctx.accounts.tick_array_lower,
        &ctx.accounts.tick_array_upper,
        &ctx.accounts.token_account_0.to_account_info(),
        &ctx.accounts.token_account_1.to_account_info(),
        &ctx.accounts.token_vault_0.to_account_info(),
        &ctx.accounts.token_vault_1.to_account_info(),
        &ctx.accounts.token_program,
        None,
        None,
        None,
        liquidity,
        amount_0_max,
        amount_1_max,
        tick_lower_index,
        tick_upper_index,
    )
}

pub fn increase_liquidity<'a, 'b, 'c: 'info, 'info>(
    payer: &'b Signer<'info>,
    pool_state_loader: &'b AccountLoader<'info, PoolState>,
    tick_array_lower_loader: &'b AccountLoader<'info, TickArrayState>,
    tick_array_upper_loader: &'b AccountLoader<'info, TickArrayState>,
    token_account_0: &'b AccountInfo<'info>,
    token_account_1: &'b AccountInfo<'info>,
    token_vault_0: &'b AccountInfo<'info>,
    token_vault_1: &'b AccountInfo<'info>,
    token_program: &'b Program<'info, Token>,
    token_program_2022: Option<&Program<'info, Token2022>>,
    vault_0_mint: Option<Box<InterfaceAccount<'info, Mint>>>,
    vault_1_mint: Option<Box<InterfaceAccount<'info, Mint>>>,

    liquidity: u128,
    amount_0_max: u64,
    amount_1_max: u64,
    tick_lower_index: i32,
    tick_upper_index: i32,
) -> Result<()> {
    let mut liquidity = liquidity;
    {
    let pool_state = &mut pool_state_loader.load_mut()?;

    let LiquidityChangeResult {
        amount_0,
        amount_1,
        ..
    } = add_liquidity(
        payer,
        token_account_0,
        token_account_1,
        token_vault_0,
        token_vault_1,
        &AccountLoad::<TickArrayState>::try_from(&tick_array_lower_loader.to_account_info())?,
        &AccountLoad::<TickArrayState>::try_from(&tick_array_upper_loader.to_account_info())?,
        token_program_2022,
        token_program,
        vault_0_mint,
        vault_1_mint,
        pool_state,
        &mut liquidity,
        amount_0_max,
        amount_1_max,
        tick_lower_index,
        tick_upper_index,
    )?;
    }

    Ok(())
}