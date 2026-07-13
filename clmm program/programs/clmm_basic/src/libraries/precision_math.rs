use super::big_num::{U128, U256, U512};

pub trait Downcast256 {
    fn as_u256(self) -> U256;
}

impl Downcast256 for U512 {
    fn as_u256(self) -> U256 {
        U256([
            self.0[0],
            self.0[1],
            self.0[2],
            self.0[3],
        ])
    }
}

pub trait Upcast256 {
    fn as_u256(self) -> U256;
}
impl Upcast256 for U128 {
    fn as_u256(self) -> U256 {
        U256([self.0[0], self.0[1], 0, 0])
    }
}

pub trait Upcast512 {
    fn as_u512(self) -> U512;
}

impl Upcast512 for U256 {
    fn as_u512(self) -> U512 {
        U512([self.0[0], self.0[1], self.0[2], self.0[3], 0, 0, 0, 0])
    }
}

impl U256 {
    pub fn mul_div_floor(self, num: U256, denom: U256) -> Option<U256> {
        assert_ne!(denom, U256::default());
        let r = (self.as_u512() * num.as_u512()) / denom.as_u512();
        if r > U256::MAX.as_u512() {
            None
        } else {
            Some(r.as_u256())
        }
    }

    pub fn mul_div_ceil(self, num: U256, denom: U256) -> Option<U256> {
        assert_ne!(denom, U256::default());
        let r =
            (self.as_u512() * num.as_u512() + (denom - 1).as_u512()) / denom.as_u512();
        if r > U256::MAX.as_u512() {
            None
        } else {
            Some(r.as_u256())
        }
    }
}


pub trait UnsafeMathTrait {
    fn div_rounding_up(x: Self, y: Self) -> Self;
}

impl UnsafeMathTrait for u64 {
    fn div_rounding_up(x: Self, y: Self) -> Self {
        x / y + ((x % y > 0) as u64)
    }
}

impl UnsafeMathTrait for U128 {
    fn div_rounding_up(x: Self, y: Self) -> Self {
        x / y + U128::from((x % y > U128::default()) as u8)
    }
}

impl UnsafeMathTrait for U256 {
    fn div_rounding_up(x: Self, y: Self) -> Self {
        x / y + U256::from((x % y > U256::default()) as u8)
    }
}