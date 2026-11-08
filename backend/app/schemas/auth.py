from pydantic import BaseModel, EmailStr, Field

from app.schemas.user import UserOut


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserOut


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=150)
    email: EmailStr


class VerifyRegistrationRequest(BaseModel):
    email: EmailStr
    otp: str = Field(min_length=4, max_length=8)
    password: str = Field(min_length=8, max_length=128)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp: str = Field(min_length=4, max_length=8)
    new_password: str = Field(min_length=8, max_length=128)


class ResendOtpRequest(BaseModel):
    email: EmailStr
    purpose: str = Field(pattern="^(register|password_reset)$")


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)
