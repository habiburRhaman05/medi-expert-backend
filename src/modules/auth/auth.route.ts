
import { Router } from "express";

import { validateRequest } from "../../middleware/validateRequest";
import { authControllers } from "./auth.controller";
import { authSchemas } from "./auth.schema";
import { authMiddleware } from "../../middleware/auth-middlewares";

const router: Router = Router();

router.post(
  "/register",
  validateRequest(authSchemas.registerUserSchema),
  authControllers.registerController
);

router.post(
  "/login",
  validateRequest(authSchemas.loginUserSchema),
  authControllers.loginController
);
router.get(
  "/me",
authMiddleware,
  authControllers.getUserProfileController
);
router.get(
  "/logout",
authMiddleware,
  authControllers.logoutUserController
);
router.post(
  "/refresh-token",
// authMiddleware,
  authControllers.getRefreshTokenController
);
router.post(
  "/request-reset-password",

  authControllers.requestPasswordResetController
);
router.put(
  "/change-password",
authMiddleware,
validateRequest(authSchemas.changePasswordSchema),
  authControllers.changePasswordController
);
router.put(
  "/reset-password",
  authControllers.resetPasswordController
);
router.get(
  "/verify-email",
  authControllers.verifyEmail
);


//google login

router.get("/login/google", authControllers.googleLogin); // when git request when a google account selct page
router.get("/google/success", authControllers.googleLoginSuccess);
router.get("/oauth/error", authControllers.handleOAuthError);
export default router;
