use anchor_lang::prelude::*;

pub type U128 = u128;

pub const MIN_TICK: i32 = -443636;
/// The minimum tick
pub const MAX_TICK: i32 = -MIN_TICK;

/// The minimum value that can be returned from #get_sqrt_price_at_tick. Equivalent to get_sqrt_price_at_tick(MIN_TICK)
pub const MIN_SQRT_PRICE_X64: u128 = 4295048016;
/// The maximum value that can be returned from #get_sqrt_price_at_tick. Equivalent to get_sqrt_price_at_tick(MAX_TICK)
pub const MAX_SQRT_PRICE_X64: u128 = 79226673521066979257578248091;

const Q64: u32 = 64;

const BIT_PRECISION: u32 = 16;

pub fn get_sqrt_price_at_tick(tick: i32) -> Result<u128> {
    let abs_tick = tick.abs() as u32;

    let mut ratio: u128 = if abs_tick & 0x1 != 0 {
        0xfffcb933bd6fb800u128
    } else {
        1u128 << 64 // 2^64
    };

    if abs_tick & 0x2 != 0 {
        ratio = (ratio * 0xfff97272373d4000u128) >> Q64;
    }
    if abs_tick & 0x4 != 0 {
        ratio = (ratio * 0xfff2e50f5f657000u128) >> Q64;
    }
    if abs_tick & 0x8 != 0 {
        ratio = (ratio * 0xffe5caca7e10f000u128) >> Q64;
    }
    if abs_tick & 0x10 != 0 {
        ratio = (ratio * 0xffcb9843d60f7000u128) >> Q64;
    }
    if abs_tick & 0x20 != 0 {
        ratio = (ratio * 0xff973b41fa98e800u128) >> Q64;
    }
    if abs_tick & 0x40 != 0 {
        ratio = (ratio * 0xff2ea16466c9b000u128) >> Q64;
    }
    if abs_tick & 0x80 != 0 {
        ratio = (ratio * 0xfe5dee046a9a3800u128) >> Q64;
    }
    if abs_tick & 0x100 != 0 {
        ratio = (ratio * 0xfcbe86c7900bb000u128) >> Q64;
    }
    if abs_tick & 0x200 != 0 {
        ratio = (ratio * 0xf987a7253ac65800u128) >> Q64;
    }
    if abs_tick & 0x400 != 0 {
        ratio = (ratio * 0xf3392b0822bb6000u128) >> Q64;
    }
    if abs_tick & 0x800 != 0 {
        ratio = (ratio * 0xe7159475a2caf000u128) >> Q64;
    }
    if abs_tick & 0x1000 != 0 {
        ratio = (ratio * 0xd097f3bdfd2f2000u128) >> Q64;
    }
    if abs_tick & 0x2000 != 0 {
        ratio = (ratio * 0xa9f746462d9f8000u128) >> Q64;
    }
    if abs_tick & 0x4000 != 0 {
        ratio = (ratio * 0x70d869a156f31c00u128) >> Q64;
    }
    if abs_tick & 0x8000 != 0 {
        ratio = (ratio * 0x31be135f97ed3200u128) >> Q64;
    }

    if tick > 0 {
        ratio = u128::MAX / ratio;
    }

    Ok(ratio)
}


/// Calculates the greatest tick value such that get_sqrt_price_at_tick(tick) <= ratio
/// Throws if sqrt_price_x64 < MIN_SQRT_RATIO or sqrt_price_x64 > MAX_SQRT_RATIO
///
/// Formula: `i = log base(√1.0001) (√P)`
pub fn get_tick_at_sqrt_price(sqrt_price_x64: u128) -> Result<i32> {
    // second inequality must be < because the price can never reach the price at the max tick

    // Determine log_b(sqrt_ratio). First by calculating integer portion (msb)
    let msb: u32 = 128 - sqrt_price_x64.leading_zeros() - 1;
    let log2p_integer_x32 = (msb as i128 - 64) << 32;

    // get fractional value (r/2^msb), msb always > 128
    // We begin the iteration from bit 63 (0.5 in Q64.64)
    let mut bit: i128 = 0x8000_0000_0000_0000i128;
    let mut precision = 0;
    let mut log2p_fraction_x64 = 0;

    // Log2 iterative approximation for the fractional part
    // Go through each 2^(j) bit where j < 64 in a Q64.64 number
    // Append current bit value to fraction result if r^2 Q2.126 is more than 2
    let mut r = if msb >= 64 {
        sqrt_price_x64 >> (msb - 63)
    } else {
        sqrt_price_x64 << (63 - msb)
    };

    while bit > 0 && precision < BIT_PRECISION {
        r *= r;
        let is_r_more_than_two = r >> 127 as u32;
        r >>= 63 + is_r_more_than_two;
        log2p_fraction_x64 += bit * is_r_more_than_two as i128;
        bit >>= 1;
        precision += 1;
    }
    let log2p_fraction_x32 = log2p_fraction_x64 >> 32;
    let log2p_x32 = log2p_integer_x32 + log2p_fraction_x32;

    // 14 bit refinement gives an error margin of 2^-14 / log2 (√1.0001) = 0.8461 < 1
    // Since tick is a decimal, an error under 1 is acceptable

    // Change of base rule: multiply with 2^32 / log2 (√1.0001)
    let log_sqrt_10001_x64 = log2p_x32 * 59543866431248i128;

    // tick - 0.01
    let tick_low = ((log_sqrt_10001_x64 - 184467440737095516i128) >> 64) as i32;

    // tick + (2^-14 / log2(√1.0001)) + 0.01
    let tick_high = ((log_sqrt_10001_x64 + 15793534762490258745i128) >> 64) as i32;

    Ok(if tick_low == tick_high {
        tick_low
    } else if get_sqrt_price_at_tick(tick_high).unwrap() <= sqrt_price_x64 {
        tick_high
    } else {
        tick_low
    })
}
