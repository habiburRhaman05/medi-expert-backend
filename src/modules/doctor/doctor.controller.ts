
import { Request, Response } from "express";

import status from "http-status";
import { doctorServices } from "./doctor.service";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/apiResponse";
import { redis } from "../../config/redis";


// =============================== GET DOCTOR BY ID ===============================
const getDoctorById = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params 
    
    const result = await doctorServices.getDoctorById(id as string);
    return sendSuccess(res, {
      statusCode: status.OK,
      data: result,
      message: "Doctor fetched successfully",
    });
  }
);


// ===============================
// GET ALL DOCTORS
// ===============================
const getAllDoctors = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await doctorServices.getAllDoctors({

      page:req.query.page as string
    });

    return sendSuccess(res, {
      statusCode: status.OK,
      data: result.data,
      meta:result.meta,
      message: "Doctors fetched successfully",
    });
  }
);


// ===============================
// UPDATE DOCTOR
// ===============================
const updateDoctor = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await doctorServices.updateDoctor({
      doctorId:id as string,
      data:req.body
    });
    return sendSuccess(res, {
      statusCode: status.OK,
      data: result,
      message: "Doctor updated successfully",
    });
  }
);

// ===============================
// DELETE DOCTOR
// ===============================
const deleteDoctor = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    await doctorServices.deleteDoctor(id as string);
    return sendSuccess(res, {
      statusCode: status.OK,
      data: null,
      message: "Doctor deleted successfully",
    });
  }
);


export const doctorController = {
  getDoctorById,
  getAllDoctors,
  updateDoctor,
  deleteDoctor,
};
