use anchor_lang::{prelude::*, system_program};
use anchor_spl::token_2022::{
    self, get_account_data_size, GetAccountDataSize, InitializeAccount3, InitializeImmutableOwner,
    Token2022,
};
use anchor_spl::token_interface::{Mint, TokenInterface};

pub fn create_token_vault_account<'info>(
    payer: &Signer<'info>,
    pool_state: &AccountInfo<'info>,
    token_account: &AccountInfo<'info>,
    token_mint: &InterfaceAccount<'info, Mint>,
    system_program: &Program<'info, System>,
    token_2022_program: &Interface<'info, TokenInterface>,
    signer_seeds: &[&[u8]],
) -> Result<()> {

    let space = token_2022::get_account_data_size(
        CpiContext::new(
            token_2022_program.to_account_info(),
            GetAccountDataSize {
                mint: token_mint.to_account_info(),
            },
        ),
        &[],
    )?;

    create_or_allocate_account(
        token_2022_program.key,
        payer.to_account_info(),
        system_program.to_account_info(),
        token_account.to_account_info(),
        signer_seeds,
        space.try_into().unwrap(),
    )?;

    let immutable_owner_required = 
        *token_2022_program.key == anchor_spl::token_2022::ID;

    if immutable_owner_required {
        token_2022::initialize_immutable_owner(CpiContext::new(
            token_2022_program.to_account_info(),
            InitializeImmutableOwner {
                account: token_account.to_account_info(),
            },
        ))?;
    }

    token_2022::initialize_account3(CpiContext::new(
        token_2022_program.to_account_info(),
        InitializeAccount3 {
            account: token_account.to_account_info(),
            mint: token_mint.to_account_info(),
            authority: pool_state.to_account_info(),
        },
    ));

    Ok(())
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