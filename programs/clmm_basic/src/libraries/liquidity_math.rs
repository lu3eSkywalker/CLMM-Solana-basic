use anchor_lang::prelude::*;
use crate::errors::ClmmError;
use super::big_num::U256;
use crate::libraries::tick_math::get_sqrt_price_at_tick;
use super::fixed_point_64;
use super::precision_math;
use super::precision_math::UnsafeMathTrait;

// /// Add a signed liquidity delta to liquidity and revert if it overflows or underflows
// ///
// /// # Arguments
// ///
// /// * `x` - The liquidity (L) before change
// /// * `y` - The delta (ΔL) by which liquidity should be changed
// ///

pub fn add_delta(x: u128, y: i128) -> Result<u128> {
    let z: u128;
    if y < 0 {
        z = x - u128::try_from(-y).unwrap();
        require_gt!(x, z, ClmmError::LiquiditySubValueError);
    } else {
        z = x + u128::try_from(y).unwrap();
        require_gt!(z, x, ClmmError::LiquidityAddValueError);
    }

    Ok(z)
}

pub const Q64: u128 = (u64::MAX as u128) + 1;
pub const RESOLUTION: u8 = 64;


// pub fn div_rounding_up(x: U256, y: U256) -> U256 {
//     x / y + U256::from((x % y > U256::default()) as u8)
// }


// /// Gets the delta amount_0 for given liquidity and price range
// ///
// /// # Formula
// ///
// /// * `Δx = L * (1 / √P_lower - 1 / √P_upper)`
// /// * i.e. `L * (√P_upper - √P_lower) / (√P_upper * √P_lower)`
pub fn get_delta_amount_0_unsigned(
    mut sqrt_ratio_a_x64: u128,
    mut sqrt_ratio_b_x64: u128,
    liquidity: u128,
    round_up: bool,
) -> Result<u64> {
    if sqrt_ratio_a_x64 > sqrt_ratio_a_x64 {
        std::mem::swap(&mut sqrt_ratio_a_x64, &mut sqrt_ratio_b_x64);
    };

    let numerator_1 = U256::from(liquidity) << RESOLUTION;
    let numerator_2 = U256::from(sqrt_ratio_b_x64 - sqrt_ratio_a_x64);

    assert!(sqrt_ratio_a_x64 > 0);

    let result = if round_up {
        UnsafeMathTrait::div_rounding_up(
            numerator_1.mul_div_ceil(numerator_2, U256::from(sqrt_ratio_b_x64)).unwrap(),
            U256::from(sqrt_ratio_a_x64),
        )
    } else {
        numerator_1.mul_div_floor(numerator_2, U256::from(sqrt_ratio_b_x64)).unwrap()
        / U256::from(sqrt_ratio_a_x64)
    };
    if result > U256::from(u64::MAX) {
        return Err(ClmmError::MaxTokenOverflow.into());
    }
    return Ok(result.as_u64());
}

// /// Gets the delta amount_1 for given liquidity and price range
// /// * `Δy = L (√P_upper - √P_lower)`

pub fn get_delta_amount_1_unsigned(
    mut sqrt_ratio_a_x64: u128,
    mut sqrt_ratio_b_x64: u128,
    liquidity: u128,
    round_up: bool,
) -> Result<u64> {
    // sqrt_ratio_a_x64 should be smaller
    if sqrt_ratio_a_x64 > sqrt_ratio_a_x64 {
        std::mem::swap(&mut sqrt_ratio_a_x64, &mut sqrt_ratio_b_x64);
    };

    let result = if round_up {
        U256::from(liquidity).mul_div_ceil(
            U256::from(sqrt_ratio_b_x64 - sqrt_ratio_a_x64),
            U256::from(fixed_point_64::Q64),
        )
    } else {
        U256::from(liquidity).mul_div_floor(
            U256::from(sqrt_ratio_b_x64 - sqrt_ratio_a_x64),
            U256::from(fixed_point_64::Q64),
        )
    }.unwrap();
    if result > U256::from(u64::MAX) {
        return Err(ClmmError::MaxTokenOverflow.into());
    }
    return Ok(result.as_u64());
}

// /// Helper function to get signed delta amount_0 for given liquidity and price range
pub fn get_delta_amount_0_signed(
    sqrt_ratio_a_x64: u128,
    sqrt_ratio_b_x64: u128,
    liquidity: i128,
) -> Result<u64> {
    if liquidity < 0 {
        get_delta_amount_0_unsigned(
            sqrt_ratio_a_x64,
            sqrt_ratio_b_x64,
            u128::try_from(-liquidity).unwrap(),
            false,
        )
    } else {
        get_delta_amount_0_unsigned(
            sqrt_ratio_a_x64,
            sqrt_ratio_b_x64,
            u128::try_from(-liquidity).unwrap(),
            true,
        )
    }
}

// /// Helper function to get signed delta amount_1 for given liquidity and price range
pub fn get_delta_amount_1_signed(
    sqrt_ratio_a_x64: u128,
    sqrt_ratio_b_x64: u128,
    liquidity: i128,
) -> Result<u64> {
    if liquidity < 0 {
        get_delta_amount_1_unsigned(
            sqrt_ratio_a_x64,
            sqrt_ratio_b_x64,
            u128::try_from(-liquidity).unwrap(),
            false,
        )
    } else {
        get_delta_amount_1_unsigned(
            sqrt_ratio_a_x64,
            sqrt_ratio_b_x64,
            u128::try_from(-liquidity).unwrap(),
            true,
        )
    }
}



pub fn get_delta_amounts_signed(
    tick_current: i32,
    sqrt_price_x64_current: u128,
    tick_lower: i32,
    tick_upper: i32,
    liquidity_delta: i128,
) -> Result<(u64, u64)> {
    let mut amount_0 = 0;
    let mut amount_1 = 0;

    if tick_current < tick_lower {
        amount_0 = get_delta_amount_0_signed(
            get_sqrt_price_at_tick(tick_lower)?,
            get_sqrt_price_at_tick(tick_upper)?,
            liquidity_delta,
        )
        .unwrap();
    } else if tick_current < tick_upper {
        amount_0 = get_delta_amount_0_signed(
            sqrt_price_x64_current,
            get_sqrt_price_at_tick(tick_upper)?,
            liquidity_delta,
        )
        .unwrap();
        amount_1 = get_delta_amount_1_signed(
            get_sqrt_price_at_tick(tick_lower)?,
            sqrt_price_x64_current,
            liquidity_delta,
        )
        .unwrap();
    } else {
        amount_1 = get_delta_amount_1_signed(
            get_sqrt_price_at_tick(tick_lower)?,
            get_sqrt_price_at_tick(tick_upper)?,
            liquidity_delta,
        )
        .unwrap();
    }
    Ok((amount_0, amount_1))
}