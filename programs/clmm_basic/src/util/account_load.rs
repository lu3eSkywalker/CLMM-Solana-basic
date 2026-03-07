use crate::errors::ClmmError;
use anchor_lang::error::{Error, ErrorCode};
use anchor_lang::solana_program::{account_info::AccountInfo, pubkey::Pubkey};
use anchor_lang::{Key, Owner, Result, ToAccountInfos, ZeroCopy};
use arrayref::array_ref;
use std::cell::{Ref, RefMut};
use std::marker::PhantomData;
use std::mem;
use std::ops::DerefMut;

#[derive(Clone)]
pub struct AccountLoad<'info, T: ZeroCopy + Owner> {
    acc_info: AccountInfo<'info>,
    phantom: PhantomData<&'info T>,
}

impl<'info, T: ZeroCopy + Owner> AccountLoad<'info, T> {
    fn new(acc_info: AccountInfo<'info>) -> AccountLoad<'info, T> {
        Self {
            acc_info,
            phantom: PhantomData,
        }
    }

    /// Constructs a new `Loader` from a previously initialized account.
    #[inline(never)]
    pub fn try_from(acc_info: &AccountInfo<'info>) -> Result<AccountLoad<'info, T>> {
        if acc_info.owner != &T::owner() {
            return Err(
                Error::from(ClmmError::InvalidMessage).with_pubkeys((*acc_info.owner, T::owner()))
            );
        }
        let data: &[u8] = &acc_info.try_borrow_data()?;
        if data.len() < T::DISCRIMINATOR.len() {
            return Err(ClmmError::InvalidMessage.into());
        }
        // Discriminator must match.
        let disc_bytes = array_ref![data, 0, 8];
        if disc_bytes != &T::DISCRIMINATOR {
            return Err(ClmmError::InvalidMessage.into());
        }

        Ok(AccountLoad::new(acc_info.clone()))
    }

    /// Constructs a new `Loader` from an uninitialized account.
    #[inline(never)]
    pub fn try_from_unchecked(
        _program_id: &Pubkey,
        acc_info: &AccountInfo<'info>,
    ) -> Result<AccountLoad<'info, T>> {
        if acc_info.owner != &T::owner() {
            return Err(
                Error::from(ClmmError::InvalidMessage).with_pubkeys((*acc_info.owner, T::owner()))
            );
        }
        Ok(AccountLoad::new(acc_info.clone()))
    }

    pub fn load_init(&self) -> Result<RefMut<T>> {
        // AccountInfo api allows you to borrow mut even if the account isn't
        // writable, so add this check for a better dev experience.
        if !self.acc_info.is_writable {
            return Err(ErrorCode::AccountNotMutable.into());
        }

        let mut data = self.acc_info.try_borrow_mut_data()?;

        // The discriminator should be zero, since we're initializing.
        let mut disc_bytes = [0u8; 8];
        disc_bytes.copy_from_slice(&data[..8]);
        let discriminator = u64::from_le_bytes(disc_bytes);
        if discriminator != 0 {
            return Err(ErrorCode::AccountDiscriminatorAlreadySet.into());
        }

        // write discriminator
        data[..8].copy_from_slice(&T::DISCRIMINATOR);

        Ok(RefMut::map(data, |data| {
            bytemuck::from_bytes_mut(&mut data.deref_mut()[8..mem::size_of::<T>() + 8])
        }))
    }

    pub fn load_mut(&self) -> Result<RefMut<T>> {
        if !self.acc_info.is_writable {
            return Err(ErrorCode::AccountNotMutable.into());
        }
        let mut data = self.acc_info.try_borrow_mut_data()?;
        Ok(RefMut::map(data, |data| {
            bytemuck::from_bytes_mut(&mut data.deref_mut()[8..mem::size_of::<T>() + 8])
        }))
    }
}

