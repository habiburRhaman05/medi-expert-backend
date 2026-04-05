import path from "path";
import { startServer } from "./app";
import { connectToDatabase, prisma } from "./config/db";
// import "./workers/emailWorker"; 
import { configureCloudinary } from "./config/cloudinary.config";

(async () => {
 
  
  await connectToDatabase();
  await configureCloudinary()
  await startServer();
  // await auth.api.signUpEmail({
  //   body:{
  //     name:"Super Admin",
  //     email:"super_admin@gmail.com",
  //     password:"superadmin1234",
  //     role:UserRole.SUPER_ADMIN,
  //     needPasswordChange:false,
     
  //   }
  // })

})();
