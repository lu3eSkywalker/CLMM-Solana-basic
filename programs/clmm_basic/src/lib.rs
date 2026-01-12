pub mod util;
pub mod libraries;
pub mod states;
use anchor_lang::prelude::*;
use crate::util::token::create_token_vault_account;
use crate::libraries::tick_math::get_tick_at_sqrt_price;
use crate::states::tick_array::get_or_create_tick_array;

use anchor_spl::token::{
    self,
    InitializeAccount,
    Token,
    TokenAccount,
    Transfer,
};

use anchor_spl::token_interface::{Mint, TokenInterface};

declare_id!("Hmch8iM23UAywLuxVks6LXUXz1Nne4vef25ncsapYZKb");

#[program]
pub mod Clmm_Basic {
    use super::*;

    pub fn create_pool(ctx: Context<CreatePool>, sqrt_price_x64: u128) -> Result<()> {

    let pool_state = &mut ctx.accounts.pool_state;

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

        ctx.accounts.pool_state.initialize(
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

//     pub fn open_position<'a, 'b, 'c: 'info, 'info>(
//     payer: &'b Signer<'info>,
//     pool_state_loader: &'b AccountLoader<'info, PoolState>,
//     tick_array_lower_loader: &'b UncheckedAccount<'info>,
//     tick_array_upper_loader: &'b UncheckedAccount<'info>,
//     token_account_0: &'b AccountInfo<'info>,
//     token_account_1: &'b AccountInfo<'info>,
//     token_vault_0: &'b AccountInfo<'info>,
//     token_vault_1: &'b AccountInfo<'info>,
//     rent: &'b Sysvar<'info, Rent>,
//     system_program: &'b Program<'info, System>,
//     token_program: &'b Program<'info, Token>,
//     _associated_token_program: &'b Program<'info, AssociatedToken>,
//     metadata_program: Option<&'b Program<'info, Metadata>>,
//     token_program_2022: Option<&'b Program<'info, Token2022>>,
//     vault_0_mint: Option<Box<InterfaceAccount<'info, token_interface::Mint>>>,
//     vault_1_mint: Option<Box<InterfaceAccount<'info, token_interface::Mint>>>,

//     remaining_accounts: &'c [AccountInfo<'info>],
//     personal_position_bump: u8,
//     liquidity: u128,
//     amount_0_max: u64,
//     amount_1_max: u64,
//     tick_lower_index: i32,
//     tick_upper_index: i32,
//     tick_array_lower_start_index: i32,
//     tick_array_upper_start_index: i32,
// ) -> Result<()> {
//     let mut liquidity = liquidity;
//     {
//         let pool_state = &mut pool_state_loader.load_mut()?;
//         if !pool_state.get_status_by_bit(PoolStatusBitIndex::OpenPositionOrIncreaseLiquidity) {
//             return err!(ErrorCode::NotApproved);
//         }

//         // Why not use anchor's `init-if-needed` to create?
//         // Beacuse `tick_array_lower` and `tick_array_upper` can be the same account, anchor can initialze tick_array_lower but it causes a crash when anchor to initialze the `tick_array_upper`,
//         // the problem is variable scope, tick_array_lower_loader not exit to save the discriminator while build tick_array_upper_loader.
//         let tick_array_lower_loader = TickArrayState::get_or_create_tick_array(
//             payer.to_account_info(),
//             tick_array_lower_loader.to_account_info(),
//             system_program.to_account_info(),
//             &pool_state_loader,
//             tick_array_lower_start_index,
//             pool_state.tick_spacing,
//         )?;

//         let tick_array_upper_loader =
//             if tick_array_lower_start_index == tick_array_upper_start_index {
//                 AccountLoad::<TickArrayState>::try_from(&tick_array_upper_loader.to_account_info())?
//             } else {
//                 TickArrayState::get_or_create_tick_array(
//                     payer.to_account_info(),
//                     tick_array_upper_loader.to_account_info(),
//                     system_program.to_account_info(),
//                     &pool_state_loader,
//                     tick_array_upper_start_index,
//                     pool_state.tick_spacing,
//                 )?
//             };

//         let use_tickarray_bitmap_extension = pool_state.is_overflow_default_tickarray_bitmap(vec![
//             tick_array_lower_start_index,
//             tick_array_upper_start_index,
//         ]);
//     }
// }
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
    pub tick_spacing: u16,
    pub current_tick: i32,
    pub bump: u8,

    pub _padding: u8,
}

// #[derive(Accounts)]
// pub struct OpenPosition<'info> {
//     #[account(mut)]
//     pub payer: Signer<'info>,

//     #[account(mut)]
//     pub pool_state: Account<'info, PoolState>,

//     #[account(
//         mut,
//         seeds = [
//             b"tick_array",
//             pool_state.key().as_ref(),
//             &tick_array_lower_start_index.to_be_bytes(),
//         ],
//         bump,
//     )]
//     pub tick_array_lower: UncheckedAccount<'info>,

//     #[account(
//         mut,
//         seeds = [
//             b"tick_array",
//             pool_state.key().as_ref(),
//             &tick_array_upper_start_index.to_be_bytes(),
//         ],
//         bump,
//     )]
//     pub tick_array_upper: UncheckedAccount<'info>,

//     #[account(
//         mut,
//         token::mint = token_vault_0.mint
//     )]
//     pub token_account_0: Box<Account<'info, TokenAccount>>,

//     #[account(
//         mut,
//         token::mint = token_vault_1.mint
//     )]
//     pub token_account_1: Box<Account<'info, TokenAccount>>,

//     #[account(
//         mut,
//         constraint = token_vault_0.key() == pool_state.load()?.token_vault_0
//     )]
//     pub token_vault_0: Box<Account<'info, TokenAccount>>,

//     #[account(
//         mut,
//         constraint = token_vault_1.key() == pool_state.load()?.token_vault_1
//     )]
//     pub token_vault_1: Box<Account<'info, TokenAccount>>,

//     pub rent: Sysvar<'info, Rent>,

//     pub system_program: Program<'info, System>,

//     pub token_program: Program<'info, Token>,
// }