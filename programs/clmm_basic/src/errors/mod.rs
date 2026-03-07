use anchor_lang::prelude::*;
pub mod errors;
pub use errors::*;


#[error_code]
pub enum ClmmError {
    #[msg("Max Token Overflow")]
    MaxTokenOverflow,
    #[msg("Liquidity Subtraction Error")]
    LiquiditySubValueError,
    #[msg("Liquidity Addition Error")]
    LiquidityAddValueError,
    #[msg("Zero Supply Liquidity")]
    ZeroSupplyLiquidity,
    #[msg("Slippage Check")]
    SlippageCheck,
    #[msg("Invalid Liquidity")]
    InvalidLiquidity,
    #[msg("Invalid Token 0 Amount")]
    ZeroToken0Amount,
    #[msg("Invalid Token 1 Amount")]
    ZeroToken1Amount,
    #[msg("Invalid Vault Account")]
    InvalidVault,
    #[msg("Test Invalid Message")]
    InvalidMessage,
}