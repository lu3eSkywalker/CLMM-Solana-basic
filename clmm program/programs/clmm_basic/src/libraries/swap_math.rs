use crate::errors::ClmmError;
use crate::libraries::liquidity_math;
use crate::libraries::sqrt_price_math;
use anchor_lang::prelude::*;

#[derive(Default, Debug)]
pub struct SwapStep {
    pub sqrt_price_next_x64: u128,
    pub amount_in: u64,
    pub amount_out: u64,
}

pub fn compute_swap_step(
    sqrt_price_current_x64: u128,
    sqrt_price_target_x64: u128,
    liquidity: u128,
    amount_remaining: u64,
    is_base_input: bool,
    zero_for_one: bool,
    block_timestamp: u32,
) -> Result<SwapStep> {
    let mut swap_step = SwapStep::default();

    if is_base_input {
        // Compute the theoretical input needed to reach the target price
        let amount_in = calculate_amount_in_range(
            sqrt_price_current_x64,
            sqrt_price_target_x64,
            liquidity,
            amount_remaining,
            is_base_input,
            zero_for_one,
            block_timestamp,
        )?;
        if amount_in.is_some() {
            swap_step.amount_in = amount_in.unwrap();
        }

        // Determine the actual next sqrt price
        swap_step.sqrt_price_next_x64 = 
            if amount_in.is_some() && amount_remaining >= swap_step.amount_in {
                sqrt_price_target_x64
            } else {
                sqrt_price_math::get_next_sqrt_price_from_input(
                    sqrt_price_current_x64,
                    liquidity,
                    amount_remaining,
                    zero_for_one,
                )
            };
    } else {
        let amount_out = calculate_amount_in_range(
            sqrt_price_current_x64,
            sqrt_price_target_x64,
            liquidity,
            amount_remaining,
            is_base_input,
            zero_for_one,
            block_timestamp,
        )?;
        if amount_out.is_some() {
            swap_step.amount_out = amount_out.unwrap();
        }

        // Determine the actual next sqrt price]
        swap_step.sqrt_price_next_x64 = 
            if amount_out.is_some() && amount_remaining >= swap_step.amount_out {
                sqrt_price_target_x64
            } else {
                sqrt_price_math::get_next_sqrt_price_from_input(
                    sqrt_price_current_x64,
                    liquidity,
                    amount_remaining,
                    zero_for_one,
                )
            }
    }

    // Check whether the target price was actually reached
    let max = sqrt_price_target_x64 == swap_step.sqrt_price_next_x64;

    // Recalculate exact amounts if the target price was NOT reached
    if zero_for_one {
        if !(max && is_base_input) {
        // Swapping token 1 -> token 0

            swap_step.amount_in = liquidity_math::get_delta_amount_0_unsigned(
                swap_step.sqrt_price_next_x64,
                sqrt_price_current_x64,
                liquidity,
                true,
            )?
        };
        if !(max && !is_base_input) {
            swap_step.amount_out = liquidity_math::get_delta_amount_1_unsigned(
                swap_step.sqrt_price_next_x64,
                sqrt_price_current_x64,
                liquidity,
                false,
            )?
        };
    } else {
        // Swapping token 1 -> token 0
        if !(max && is_base_input) {
            swap_step.amount_in = liquidity_math::get_delta_amount_1_unsigned(
                sqrt_price_current_x64,
                swap_step.sqrt_price_next_x64,
                liquidity,
                true,
            )?
        };
        if !(max && !is_base_input) {
            swap_step.amount_out = liquidity_math::get_delta_amount_0_unsigned(
                sqrt_price_current_x64,
                swap_step.sqrt_price_next_x64,
                liquidity,
                false,
            )?
        };
    }

    if !is_base_input && swap_step.amount_out > amount_remaining {
        swap_step.amount_out = amount_remaining;
    }

    Ok(swap_step)
}

fn calculate_amount_in_range(
    sqrt_price_current_x64: u128,
    sqrt_price_target_x64: u128,
    liquidity: u128,
    amount_remaining: u64,
    is_base_input: bool,
    zero_for_one: bool,
    block_timestamp: u32,
) -> Result<Option<u64>> {
    if is_base_input {
        let result  = if zero_for_one {
            liquidity_math::get_delta_amount_0_unsigned(
                sqrt_price_target_x64,
                sqrt_price_current_x64,
                liquidity,
                true,
            )
        } else {
            liquidity_math::get_delta_amount_1_unsigned(
                sqrt_price_current_x64,
                sqrt_price_target_x64,
                liquidity,
                true,
            )
        };

        if result.is_ok() {
            return Ok(Some(result.unwrap()));
        } else {
            if result.err().unwrap() == ClmmError::MaxTokenOverflow.into() {
                return Ok(None);
            } else {
                return Err(ClmmError::MaxTokenOverflow.into());
            }
        }
    } else {
        let result  = if zero_for_one {
            liquidity_math::get_delta_amount_1_unsigned(
                sqrt_price_target_x64,
                sqrt_price_current_x64,
                liquidity,
                false,
            )
        } else {
            liquidity_math::get_delta_amount_0_unsigned(
                sqrt_price_current_x64,
                sqrt_price_target_x64,
                liquidity,
                false,
            )
        };

        if result.is_ok() {
            return Ok(Some(result.unwrap()));
        } else {
            if result.err().unwrap() == ClmmError::MaxTokenOverflow.into() {
                return Ok(None);
            } else {
                return Err(ClmmError::MaxTokenOverflow.into());
            }
        }
    }
}