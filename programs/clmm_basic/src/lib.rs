pub mod util;
use anchor_lang::prelude::*;

use anchor_spl::token::{
    self,
    InitializeAccount,
    Token,
    TokenAccount,
    Transfer,
};

use anchor_spl::token_interface::{Mint, TokenInterface};

declare_id!("3jstWhbtpX6HbLyDp7PiNyyeKvL41ZWo1ja4xz2UjJX7");

#[program]
pub mod Clmm_Basic {
    use super::*;

    pub fn create_pool(ctx: Context<CreatePool>, sqrt_price_x64: u128, open_time: u64) -> Result<()> {

        // init token vault accounts
        Ok(())
    }
}

impl PoolState {
    pub const LEN: usize = 8 + std::mem::size_of::<PoolState>();
}

#[derive(Accounts)]
pub struct CreatePool<'info> {
    /// Address paying to create the pool. Can be anyone
    #[account(mut)]
    pub pool_creator: Signer<'info>,

    /// Initialize an account to store the pool state
    #[account(
        init,
        seeds = [
            b"pool_seed",
            token_mint_0.key().as_ref(),
            token_mint_1.key().as_ref(),
        ],
        bump,
        payer = pool_creator,
        space = PoolState::LEN
    )]
    pub pool_state: Account<'info, PoolState>,

    /// Token_0 mint, the key must be smaller then token_1 mint.
    #[account(
        constraint = token_mint_0.key() < token_mint_1.key(),
        mint::token_program = token_program_0
    )]
    pub token_mint_0: Box<InterfaceAccount<'info, Mint>>,

    /// Token_1 mint
    #[account(
        mint::token_program = token_program_1
    )]
    pub token_mint_1: Box<InterfaceAccount<'info, Mint>>,

    /// CHECK: Token_0 vault for the pool, initialized in contract
    #[account(
        mut,
        seeds =[
            b"pool_vault",
            pool_state.key().as_ref(),
            token_mint_0.key().as_ref(),
        ],
        bump,
    )]
    pub token_vault_0: UncheckedAccount<'info>,

    /// CHECK: Token_1 vault for the pool, initialized in contract
    #[account(
        mut,
        seeds =[
            b"pool_vault",
            pool_state.key().as_ref(),
            token_mint_1.key().as_ref(),
        ],
        bump,
    )]
    pub token_vault_1: UncheckedAccount<'info>,

    /// Spl token program or token program 2022
    pub token_program_0: Interface<'info, TokenInterface>,
    /// Spl token program or token program 2022
    pub token_program_1: Interface<'info, TokenInterface>,
    /// To create a new program account
    pub system_program: Program<'info, System>,
    /// Sysvar for program account
    pub rent: Sysvar<'info, Rent>,
}

#[account]
pub struct PoolState {
    pub sqrt_price_x64: u128,
    pub liquidity: u128,

    pub token_mint_0: Pubkey,
    pub token_mint_1: Pubkey,
    pub token_vault_0: Pubkey,
    pub token_vault_1: Pubkey,

    pub open_time: u64,
    pub current_tick: i32,
    pub tick_spacing: u16,
    pub bump: u8,

    pub _padding: u8,
}