use anchor_lang::{prelude::*, system_program};
use crate::PoolState;
use crate::states::tick_array::get_or_create_tick_array;

pub fn open_position<'a, 'b: 'info, 'c: 'info, 'info>(
    payer: &'b Signer<'info>,
    tick_array_lower_loader: &'b UncheckedAccount<'info>,
    tick_array_upper_loader: &'b UncheckedAccount<'info>,
    pool_state_loader: &'b Account<'info, PoolState>,
    system_program: &'b Program<'info, System>,
    liquidity: u128,
    tick_array_lower_start_index: i32,
    tick_array_upper_start_index: i32,
    tick_spacing: u16,
) -> Result<()> {

    let tick_array_lower_loader_to_use = get_or_create_tick_array(
        payer.to_account_info(),
        tick_array_lower_loader,
        system_program,
        pool_state_loader,
        tick_array_lower_start_index,
        tick_spacing,
    )?;

    let tick_array_lower_loader_to_use = get_or_create_tick_array(
        payer.to_account_info(),
        tick_array_upper_loader,
        system_program,
        pool_state_loader,
        tick_array_upper_start_index,
        tick_spacing,
    )?;

    Ok(())
}