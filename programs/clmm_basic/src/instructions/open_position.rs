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


pub fn open_position<'a, 'b: 'info, 'c: 'info, 'info>(
    payer: &'b Signer<'info>,
    token_account_0: &'b AccountInfo<'info>,
    token_account_1: &'b AccountInfo<'info>,
    token_vault_0: &'b AccountInfo<'info>,
    token_vault_1: &'b AccountInfo<'info>,
    tick_array_lower_loader: &'b AccountLoader<'info, TickArrayState>,
    tick_array_upper_loader: &'b AccountLoader<'info, TickArrayState>,
    pool_state_loader: &'b AccountLoader<'info, PoolState>,
    system_program: &'b Program<'info, System>,
    mut liquidity: u128,
    tick_array_lower_start_index: i32,
    tick_array_upper_start_index: i32,
    tick_spacing: u16,
    token_program_2022: Option<&'b Program<'info, Token2022>>,
    token_program: &'b Program<'info, Token>,
    vault_0_mint: Option<Box<InterfaceAccount<'info, token_interface::Mint>>>,
    vault_1_mint: Option<Box<InterfaceAccount<'info, token_interface::Mint>>>,
    amount_0_max: u64,
    amount_1_max: u64,
    tick_lower_index: i32,
    tick_upper_index: i32,
) -> Result<()> {
    let mut pool_state = pool_state_loader.load_mut()?;
    
    TickArrayState::get_or_create_tick_array(
        payer.to_account_info(),
        tick_array_lower_loader,
        system_program.to_account_info(),
        pool_state_loader,
        tick_array_lower_start_index,
        tick_spacing,
    )?;
    
    TickArrayState::get_or_create_tick_array(
        payer.to_account_info(),
        tick_array_upper_loader,
        system_program.to_account_info(),
        pool_state_loader,
        tick_array_upper_start_index,
        tick_spacing,
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
        tick_array_lower_loader,
        tick_array_upper_loader,
        token_program_2022,
        token_program,
        vault_0_mint,
        vault_1_mint,
        &mut pool_state,
        &mut liquidity,
        amount_0_max,
        amount_1_max,
        tick_lower_index,
        tick_upper_index,
    )?;
    
    Ok(())
}