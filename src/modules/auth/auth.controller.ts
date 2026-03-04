import type { Request, Response } from "express";
import { sendSuccess } from "../../utils/apiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { authServices } from "./auth.service";
import { CookieUtils } from "../../utils/cookie";
import { tokenUtils } from "../../utils/token";
import { envConfig } from "../../config/env";
import status from "http-status"
import { AppError } from "../../utils/AppError";
import { auth } from "../../lib/auth";
const isProduction = envConfig.NODE_ENV === "production";

// -------------------- REGISTER --------------------
const registerController = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password ,contactNumber} = req.body;

  const result = await authServices.registerPatient({
    name, email, password,contactNumber
  })
  return sendSuccess(res, {
    statusCode: 201,
    data: result,
    message: " Patient Account Created Successfully"
  })
});

// -------------------- LOGIN --------------------
const loginController = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  ;


  // common approse with accesstoken and refreshtoken

  const data = await authServices.loginUser({ email, password })

  tokenUtils.setAccessTokenCookie(res, data.accessToken)
  tokenUtils.setRefreshTokenCookie(res, data.refreshToken)
  tokenUtils.setBetterAuthSessionCookie(res, data.sessionToken)
  // handle cookie with better-auth custom route 
  // const response = await authServices.loginUser({email,password})
  // const setCookie = response.headers.get("set-cookie");

  // if (setCookie) {
  //   res.setHeader("set-cookie", setCookie);
  // }

  // // 4. Return the user/data as JSON
  // const data = await response.json();
  return sendSuccess(res, {
    statusCode: 200,
    data,
    message: "your are LoggedIn Sucessfully"
  })
});
// -------------------- PROFILE DATA --------------------
const getUserProfileController = asyncHandler(async (req: Request, res: Response) => {

  const user = await authServices.getUserProfile(res.locals.auth)
  return sendSuccess(res, {
    data: user,
    message: "Profile Data fetch Successfully"
  })
});
// -------------------- LOGOUT --------------------
const logoutUserController = asyncHandler(async (req: Request, res: Response) => {


  const better_auth_session_token = req.cookies["better-auth.session_token"]
  const refreshToken = req.cookies["refreshToken"]

  const user = await authServices.logoutUser(better_auth_session_token,refreshToken)
  CookieUtils.clearCookie(res, "accessToken", {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: '/',
    maxAge: 15 * 60 * 1000,
  })
  CookieUtils.clearCookie(res, "refreshToken", {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  })
  CookieUtils.clearCookie(res, "better-auth.session_token", {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: '/',
    maxAge: 24 * 60 * 60 * 1000,
  })
  return sendSuccess(res, {
    statusCode: 200,
    data: user,
    message: "User Logout Successfully"
  })
});
// -------------------- CHANGE PASSWORD --------------------
const changePasswordController = asyncHandler(async (req: Request, res: Response) => {



  const better_auth_session_token = req.cookies["better-auth.session_token"];

  const { currentPassword, newPassword } = req.body

  const user = await authServices.changePassword({
    sessionToken: better_auth_session_token,
    currentPassword,
    newPassword
  })

  return sendSuccess(res, {
    statusCode: 200,
    data: user,
    message: "Password change Successfully"
  })
});
// -------------------- REFRESH TOKEN --------------------
const getRefreshTokenController = asyncHandler(async (req: Request, res: Response) => {

console.log(req.cookies);

  const refreshToken = req.cookies.refreshToken;
  const sessionToken = req.cookies["better-auth.session_token"];
  if (!refreshToken) {
    throw new AppError("Refresh token is missing", status.UNAUTHORIZED);
  }

  // const  {cookie,token} = req.body;
  const result = await authServices.getAllNewTokens(refreshToken, sessionToken)
  // console.log(sessionToken);

  tokenUtils.setAccessTokenCookie(res, result.accessToken)
  tokenUtils.setRefreshTokenCookie(res, result.refreshToken)
  tokenUtils.setBetterAuthSessionCookie(res, result.sessionToken)

  return sendSuccess(res, {
    statusCode: 201,
    message: "refresh token generate Successfully",
    data: result
  })
});
// -------------------- REQUEST FOR RESET PASSWORD MAIL --------------------
const requestPasswordResetController = asyncHandler(async (req: Request, res: Response) => {

  const { email } = req.body;


  const result = await authServices.requestResetPassword(email)

  return sendSuccess(res, {
    statusCode: 201,
    message: "Reset Password Link successFully send; Check Index",
  })
});
// --------------------  RESET PASSWORD MAIL --------------------
const resetPasswordController = asyncHandler(async (req: Request, res: Response) => {

  const { newPassword } = req.body;
  const { token } = req.query

  const result = await authServices.resetPassword(newPassword, token as string)
  return sendSuccess(res, {
    statusCode: 201,
    message: "Your Reset Password  successFully",
  })
});

// --------------------  VERIFY EMAIL --------------------
const verifyEmail = asyncHandler(async (req, res) => {
  const { token, callbackURL } = req.query;
  if (!token || typeof token !== "string") {
    return res.status(400).send("Token missing");
  }
  try {
   await authServices.verifyEmail(token)
   console.log(callbackURL);
   
    return res.redirect(callbackURL as string);
  } catch (error: any) {
    return res.redirect(`${envConfig.CLIENT_URL}/verify-email-error`);
  }
})




// --------------------  LOGIN WITH GOOGLE --------------------

const googleLogin = asyncHandler(async (req: Request, res: Response) => {
  const redirectPath = req.query.redirect || "/dashboard";

  const encodedRedirectPath = encodeURIComponent(redirectPath as string);

  const callbackURL = `${envConfig.BETTER_AUTH_URL}/api/v1/auth/google/success?redirect=${encodedRedirectPath}`;
  const nonce = "random-string-123";
  res.render("googleRedirect", {
    callbackURL: callbackURL,
    betterAuthUrl: envConfig.BETTER_AUTH_URL,
    scriptNonce: nonce
  })
})

const googleLoginSuccess = asyncHandler(async (req: Request, res: Response) => {
  const redirectPath = req.query.redirect as string || "/dashboard/patient";

  const sessionToken = req.cookies["better-auth.session_token"];

  if (!sessionToken) {
    return res.redirect(`${envConfig.CLIENT_URL}/login?error=oauth_failed`);
  }

  const session = await auth.api.getSession({
    headers: {
      "Cookie": `better-auth.session_token=${sessionToken}`
    }
  })

  if (!session) {
    return res.redirect(`${envConfig.CLIENT_URL}/login?error=no_session_found`);
  }


  if (session && !session.user) {
    return res.redirect(`${envConfig.CLIENT_URL}/login?error=no_user_found`);
  }

  const result = await authServices.googleLoginSuccess(session);

  const { accessToken, refreshToken } = result;

  tokenUtils.setAccessTokenCookie(res, accessToken);
  tokenUtils.setRefreshTokenCookie(res, refreshToken);
  // ?redirect=//profile -> /profile
  const isValidRedirectPath = redirectPath.startsWith("/") && !redirectPath.startsWith("//");
  // const finalRedirectPath = isValidRedirectPath ? redirectPath : "/dashboard";
console.log(redirectPath);

  res.redirect(`${envConfig.CLIENT_URL}${redirectPath}`);
})

const handleOAuthError = asyncHandler(async (req: Request, res: Response) => {
  const error = req.query.error as string || "oauth_failed";
  res.redirect(`${envConfig.CLIENT_URL}/login?error=${error}`);
})

export const authControllers = {
  registerController, loginController, getUserProfileController, logoutUserController,
  changePasswordController,
  getRefreshTokenController,
  requestPasswordResetController, resetPasswordController,
  handleOAuthError,
  googleLoginSuccess,
  googleLogin,
  verifyEmail
};
