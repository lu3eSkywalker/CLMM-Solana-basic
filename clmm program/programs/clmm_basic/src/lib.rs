pub mod util;
pub mod errors;
pub mod libraries;
pub mod states;
pub mod instructions;

use anchor_lang::prelude::*;
use crate::util::*;
use crate::libraries::*;
use crate::states::*;
use crate::instructions::*;
use anchor_spl::token_interface;
use crate::errors::*;

use anchor_spl::token::{self, InitializeAccount, Token, TokenAccount, Transfer};

use anchor_spl::token_interface::{Mint, TokenInterface};

declare_id!("ERVBWDNeqHjarW6En4X9383tJxCGS1i2htLNUyFoBeej");

#[program]
pub mod clmm_basic {
    use super::*;

    pub fn create_pool(ctx: Context<CreatePool>, sqrt_price_x64: u128) -> Result<()> {

    // let pool_state = &mut ctx.accounts.pool_state;
    let mut pool_state = &mut ctx.accounts.pool_state.load_init()?;

    let tick = get_tick_at_sqrt_price(sqrt_price_x64)?;
    
    // init token vault accounts
        create_token_vault_account(
            &ctx.accounts.pool_creator,
            &ctx.accounts.pool_state.to_account_info(),
            &ctx.accounts.token_vault_0,
            &ctx.accounts.token_mint_0,
            &ctx.accounts.system_program,
            &ctx.accounts.token_program_0,
            &[
                b"pool_vault",
                ctx.accounts.pool_state.key().as_ref(),
                ctx.accounts.token_mint_0.key().as_ref(),
                &[ctx.bumps.token_vault_0][..],
            ],
        )?;

        create_token_vault_account(
            &ctx.accounts.pool_creator,
            &ctx.accounts.pool_state.to_account_info(),
            &ctx.accounts.token_vault_1,
            &ctx.accounts.token_mint_1,
            &ctx.accounts.system_program,
            &ctx.accounts.token_program_1,
            &[
                b"pool_vault",
                ctx.accounts.pool_state.key().as_ref(),
                ctx.accounts.token_mint_1.key().as_ref(),
                &[ctx.bumps.token_vault_1][..],
            ],
        )?;

        let bump = ctx.bumps.pool_state;
        let tick_spacing: u128 = 1;

        pool_state.initialize(
            ctx.accounts.token_mint_0.as_ref(),
            ctx.accounts.token_mint_1.as_ref(),
            ctx.accounts.token_vault_0.key(),
            ctx.accounts.token_vault_1.key(),
            tick_spacing as u16,
            sqrt_price_x64,
            tick,
            bump,
        )?;
        Ok(())
    }

    pub fn open_position<'a, 'b, 'c: 'info, 'info>(
        ctx: Context<'a, 'b, 'c, 'info, OpenPosition<'info>>,
        tick_lower_index: i32,
        tick_upper_index: i32,
        tick_array_lower_start_index: i32,
        tick_array_upper_start_index: i32,
        liquidity: u128,
        amount_0_max: u64,
        amount_1_max: u64,
    ) -> Result<()> {
        open_position_v1(
            ctx,
            liquidity,
            amount_0_max,
            amount_1_max,
            tick_lower_index,
            tick_upper_index,
            tick_array_lower_start_index,
            tick_array_upper_start_index,
        )
    }

    pub fn increase_liquidity<'a, 'b, 'c: 'info, 'info>(
        ctx: Context<'a, 'b, 'c, 'info, IncreaseLiquidity<'info>>,
        liquidity: u128,
        amount_0_max: u64,
        amount_1_max: u64,
        tick_lower_index: i32,
        tick_upper_index: i32,
    ) -> Result<()> {
        increase_liquidity_v1(
            ctx,
            liquidity,
            amount_0_max,
            amount_1_max,
            tick_lower_index,
            tick_upper_index,
        )
    }

    pub fn decrease_liquidity<'a, 'b, 'c: 'info, 'info>(
        ctx: Context<'a, 'b, 'c, 'info, DecreaseLiquidity<'info>>,
        liquidity: u128,
        amount_0_min: u64,
        amount_1_min: u64,
        tick_lower_index: i32,
        tick_upper_index: i32,
    ) -> Result<()> {
    crate::instructions::decrease_liquidity::decrease_liquidity(
        &ctx.accounts.pool_state,
        &ctx.accounts.token_vault_0.to_account_info(),
        &ctx.accounts.token_vault_1.to_account_info(),
        &ctx.accounts.tick_array_lower,
        &ctx.accounts.tick_array_upper,
        &ctx.accounts.recipient_token_account_0.to_account_info(),
        &ctx.accounts.recipient_token_account_1.to_account_info(),
        &ctx.accounts.token_program,
        None,
        None,
        None,
        liquidity,
        amount_0_min,
        amount_1_min,
        tick_lower_index,
        tick_upper_index
    )
    }

    pub fn swap<'a, 'b, 'c: 'info, 'info>(
        ctx: Context<'a, 'b, 'c, 'info, Swap<'info>>,
        amount: u64,
        other_amount_threshold: u64,
        sqrt_price_limit_x64: u128,
        is_base_input: bool,
    ) -> Result<()> {
        instructions::swap::swap(ctx, amount, other_amount_threshold, sqrt_price_limit_x64, is_base_input)
    }
}

impl PoolState {
    pub const LEN: usize = 8 + std::mem::size_of::<PoolState>();
}

impl PoolState {
    pub fn initialize(
        &mut self,
        mint_0: &InterfaceAccount<Mint>,
        mint_1: &InterfaceAccount<Mint>,
        vault_0: Pubkey,
        vault_1: Pubkey,
        tick_spacing: u16,
        sqrt_price_x64: u128,
        current_tick: i32,
        bump: u8,
    ) -> Result<()> {
        
        self.token_mint_0 = mint_0.to_account_info().key();
        self.token_mint_1 = mint_1.to_account_info().key();
        self.token_vault_0 = vault_0;
        self.token_vault_1 = vault_1;
        
        self.sqrt_price_x64 = sqrt_price_x64;
        self.current_tick = current_tick;
        self.tick_spacing = tick_spacing;
        self.bump = bump;
        self.open_time = Clock::get()?.unix_timestamp as u64;

        Ok(())
    }
    
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
    // pub pool_state: Account<'info, PoolState>,
    pub pool_state: AccountLoader<'info, PoolState>,

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

#[account(zero_copy(unsafe))]
#[repr(C, packed)]
#[derive(Default, Debug)]
pub struct PoolState {
    pub sqrt_price_x64: u128,
    pub liquidity: u128,

    pub token_mint_0: Pubkey,
    pub token_mint_1: Pubkey,
    pub token_vault_0: Pubkey,
    pub token_vault_1: Pubkey,

    pub open_time: u64,
    pub tick_spacing: u16,
    pub current_tick: i32,
    pub bump: u8,

    pub _padding: u8,
}