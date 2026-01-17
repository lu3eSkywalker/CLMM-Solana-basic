use anchor_lang::{prelude::*, system_program};
use crate::PoolState;

pub const TICK_ARRAY_SIZE_USIZE: usize = 60;
pub const TICK_ARRAY_SIZE: i32 = 60;

impl TickState {
    pub const LEN: usize =
        8 +  // Anchor discriminator
        4 +  // tick
        16 + // liquidity_net
        16 + // liquidity_gross
        52;  // padding
}

impl TickArrayState {
    pub const LEN: usize = 8 + 32 + 4 + 96 + 1 + 115;
}

#[account(zero_copy(unsafe))]
#[repr(C)]
pub struct TickArrayState {
    pub pool_id: Pubkey,
    pub start_tick_index: i32,
    pub ticks: [TickState; TICK_ARRAY_SIZE_USIZE],
    pub initialized_tick_count: u8,
    pub recent_epoch: u64,
    pub padding: [u8; 107],
}

pub fn get_or_create_tick_array<'info>(
    payer: AccountInfo<'info>,
    tick_array_account_info: &'info AccountInfo<'info>,
    system_program: &AccountInfo<'info>,
    pool_account: &Account<'info, PoolState>,
    tick_array_start_index: i32,
    tick_spacing: u16,
) -> Result<()> {

    if tick_array_account_info.owner == &system_program::ID {
        let (expected_pda, bump) = Pubkey::find_program_address(
            &[
                b"tick_array",
                pool_account.key().as_ref(),
                &tick_array_start_index.to_be_bytes(),
            ],
            &crate::id(),
        );

        require_keys_eq!(expected_pda, tick_array_account_info.key());

        create_or_allocate_account(
            &crate::id(),
            payer.clone(),
            system_program.clone(),
            tick_array_account_info.clone(),
            &[
                b"tick_array",
                pool_account.key().as_ref(),
                &tick_array_start_index.to_be_bytes(),
                &[bump],
            ],
            TickArrayState::LEN,
        )?;

        let loader = AccountLoader::<TickArrayState>::try_from_unchecked(
            &crate::id(),
            tick_array_account_info,
        )?;
        let mut tick_array = loader.load_init()?; // mutable zero-copy borrow
        tick_array.initialize(tick_array_start_index, tick_spacing, pool_account.key())?;
        Ok(())
    } else {
        AccountLoader::<TickArrayState>::try_from(tick_array_account_info)?;

        Ok(())
    }
}

impl TickArrayState {
pub fn initialize(
    &mut self,
    start_index: i32,
    tick_spacing: u16,
    pool_key: Pubkey,
) -> Result<()> {
    self.start_tick_index = start_index;
    self.pool_id = pool_key;
    self.recent_epoch = Clock::get()?.epoch;
    Ok(())
}
}

#[zero_copy(unsafe)]
#[repr(C, packed)]
pub struct TickState {
    pub tick: i32,
    pub liquidity_net: i128,
    pub liquidity_gross: u128,
    pub padding: [u32; 13],
}

pub fn create_or_allocate_account<'a>(
    program_id: &Pubkey,
    payer: AccountInfo<'a>,
    system_program: AccountInfo<'a>,
    target_account: AccountInfo<'a>,
    siger_seed: &[&[u8]],
    space: usize,
) -> Result<()> {
    let rent = Rent::get()?;
    let current_lamports = target_account.lamports();

    if current_lamports == 0 {
        let lamports = rent.minimum_balance(space);
        let cpi_accounts = system_program::CreateAccount {
            from: payer,
            to: target_account.clone(),
        };
        let cpi_context = CpiContext::new(system_program.clone(), cpi_accounts);
        system_program::create_account(
            cpi_context.with_signer(&[siger_seed]),
            lamports,
            u64::try_from(space).unwrap(),
            program_id,
        )?;
    } else {
        let required_lamports = rent
            .minimum_balance(space)
            .max(1)
            .saturating_sub(current_lamports);
        if required_lamports > 0 {
            let cpi_accounts = system_program::Transfer {
                from: payer.to_account_info(),
                to: target_account.clone(),
            };
            let cpi_context = CpiContext::new(system_program.clone(), cpi_accounts);
            system_program::transfer(cpi_context, required_lamports)?;
        }
        let cpi_accounts = system_program::Allocate {
            account_to_allocate: target_account.clone(),
        };
        let cpi_context = CpiContext::new(system_program.clone(), cpi_accounts);
        system_program::allocate(
            cpi_context.with_signer(&[siger_seed]),
            u64::try_from(space).unwrap(),
        )?;

        let cpi_accounts = system_program::Assign {
            account_to_assign: target_account.clone(),
        };
        let cpi_context = CpiContext::new(system_program.clone(), cpi_accounts);
        system_program::assign(cpi_context.with_signer(&[siger_seed]), program_id)?;
    }
    Ok(())
}

pub fn get_tick_state_mut(
    tick_array: &mut TickArrayState,
    tick_index: i32,
    tick_spacing: u16,
) -> Result<&mut TickState> {
    let offset_in_array = get_tick_offset_in_array(tick_array, tick_index, tick_spacing)?;
    Ok(&mut tick_array.ticks[offset_in_array])
}

pub fn get_tick_offset_in_array(tick_array: &TickArrayState, tick_index: i32, tick_spacing: u16) -> Result<usize> {
    let start_tick_index = get_array_start_index(tick_index, tick_spacing);
    // require_eq!(
    //     start_tick_index,
    //     tick_array.start_tick_index,
    //     ErrorCode::InvalidTickArray
    // );
    let offset_in_array = 
        ((tick_index - tick_array.start_tick_index) / i32::from(tick_spacing)) as usize;
    Ok(offset_in_array)
}

pub fn get_array_start_index(tick_index: i32, tick_spacing: u16) -> i32 {
    let ticks_in_array = tick_count(tick_spacing);
    let mut start = tick_index / ticks_in_array;
    if tick_index < 0 && tick_index % ticks_in_array != 0 {
        start = start - 1
    }
    start * ticks_in_array
}

pub fn tick_count(tick_spacing: u16) -> i32 {
    TICK_ARRAY_SIZE * i32::from(tick_spacing)
}

pub fn update_tick_state(
    tick_array: &mut TickArrayState,
    tick_index: i32,
    tick_spacing: u16,
    tick_state: TickState,
) -> Result<()> {
    let offset_in_array = get_tick_offset_in_array(tick_array, tick_index, tick_spacing)?;
    tick_array.ticks[offset_in_array] = tick_state;
    tick_array.recent_epoch = Clock::get()?.epoch;

    Ok(())
}