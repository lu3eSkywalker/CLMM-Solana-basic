use anchor_lang::{prelude::*, system_program};
use crate::PoolState;
use crate::errors::ClmmError;
use crate::states::*;
use crate::states::tick_array;
use crate::states::tick_array::TickArrayState;
use crate::instructions::add_liquidity::add_liquidity;
use crate::instructions::add_liquidity::LiquidityChangeResult;
use anchor_spl::token_interface;
use anchor_spl::token::{Mint, Token, TokenAccount};
use anchor_spl::token_2022::{self, spl_token_2022::instruction::AuthorityType, Token2022};


    #[derive(Accounts)]
    #[instruction
    (
        tick_lower_index: i32,        // 1st arg
        tick_upper_index: i32,
        tick_array_lower_start_index:i32, 
        tick_array_upper_start_index:i32,
    )]
    pub struct OpenPosition<'info> {
        #[account(mut)]
        pub payer: Signer<'info>,

        #[account(mut)]
        pub pool_state: AccountLoader<'info, PoolState>,

        /// CHECK
        #[account(
            mut,
            seeds = [
                b"tick_array",
                pool_state.key().as_ref(),
                &tick_array_lower_start_index.to_be_bytes(),
            ],
            bump,
        )]
        pub tick_array_lower: UncheckedAccount<'info>,

        /// CHECK
        #[account(
            mut,
            seeds = [
                b"tick_array",
                pool_state.key().as_ref(),
                &tick_array_upper_start_index.to_be_bytes(),
            ],
            bump,
        )]
        pub tick_array_upper: UncheckedAccount<'info>,

        #[account(
            mut,
            token::mint = token_vault_0.mint
        )]
        pub token_account_0: Box<Account<'info, TokenAccount>>,

        #[account(
            mut,
            token::mint = token_vault_1.mint
        )]
        pub token_account_1: Box<Account<'info, TokenAccount>>,

        #[account(
            mut,
            // constraint = token_vault_0.key() == pool_state.token_vault_0
        )]
        pub token_vault_0: Box<Account<'info, TokenAccount>>,

        #[account(
            mut,
            // constraint = token_vault_1.key() == pool_state.token_vault_1
        )]
        pub token_vault_1: Box<Account<'info, TokenAccount>>,

        pub rent: Sysvar<'info, Rent>,

        pub system_program: Program<'info, System>,

        pub token_program: Program<'info, Token>,
    }

pub fn open_position_v1<'a, 'b, 'c: 'info, 'info>(
    ctx: Context<'a, 'b, 'c, 'info, OpenPosition<'info>>,
    liquidity: u128,
    amount_0_max: u64,
    amount_1_max: u64,
    tick_lower_index: i32,
    tick_upper_index: i32,
    tick_array_lower_start_index: i32,
    tick_array_upper_start_index: i32,
) -> Result<()> {
    open_position(
        &ctx.accounts.payer,
        &ctx.accounts.pool_state,
        &ctx.accounts.tick_array_lower,
        &ctx.accounts.tick_array_upper,     
        &ctx.accounts.token_account_0.to_account_info(),
        &ctx.accounts.token_account_1.to_account_info(),
        &ctx.accounts.token_vault_0.to_account_info(),
        &ctx.accounts.token_vault_1.to_account_info(),
        &ctx.accounts.system_program,
        liquidity,
        tick_array_lower_start_index,
        tick_array_upper_start_index,
        None,
        &ctx.accounts.token_program,
        None,
        None,
        amount_0_max,
        amount_1_max,
        tick_lower_index,
        tick_upper_index,
    )
}

pub fn open_position<'a, 'b, 'c: 'info, 'info>(
    payer: &'b Signer<'info>,
    pool_state_loader: &'b AccountLoader<'info, PoolState>,
    tick_array_lower_loader: &'b UncheckedAccount<'info>,
    tick_array_upper_loader: &'b UncheckedAccount<'info>,
    token_account_0: &'b AccountInfo<'info>,
    token_account_1: &'b AccountInfo<'info>,
    token_vault_0: &'b AccountInfo<'info>,
    token_vault_1: &'b AccountInfo<'info>,
    system_program: &'b Program<'info, System>,
    liquidity: u128,
    tick_array_lower_start_index: i32,
    tick_array_upper_start_index: i32,
    token_program_2022: Option<&'b Program<'info, Token2022>>,
    token_program: &'b Program<'info, Token>,
    vault_0_mint: Option<Box<InterfaceAccount<'info, token_interface::Mint>>>,
    vault_1_mint: Option<Box<InterfaceAccount<'info, token_interface::Mint>>>,
    amount_0_max: u64,
    amount_1_max: u64,
    tick_lower_index: i32,
    tick_upper_index: i32,
) -> Result<()> {

    let mut liquidity = liquidity;
    {
        let pool_state = &mut pool_state_loader.load_mut()?;

        // require_keys_eq!(
        //     token_vault_0.key(),
        //     pool_state.token_vault_0,
        //     ClmmError::InvalidVault
        // );

        // require_keys_eq!(
        //     token_vault_1.key(),
        //     pool_state.token_vault_1,
        //     ClmmError::InvalidVault
        // );
        
        let tick_array_lower_loader = TickArrayState::get_or_create_tick_array(
            payer.to_account_info(),
            tick_array_lower_loader.to_account_info(),
            system_program.to_account_info(),
            &pool_state_loader,
            tick_array_lower_start_index,
            pool_state.tick_spacing,
        )?;
        
        let tick_array_upper_loader = TickArrayState::get_or_create_tick_array(
            payer.to_account_info(),
            tick_array_upper_loader.to_account_info(),
            system_program.to_account_info(),
            &pool_state_loader,
            tick_array_upper_start_index,
            pool_state.tick_spacing,
        )?;
        
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
            &tick_array_lower_loader,
            &tick_array_upper_loader,
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