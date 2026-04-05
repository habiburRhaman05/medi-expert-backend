import { ADMIN_LIST_CACHE } from "../../config/cacheKeys";
import { redis } from "../../config/redis";
import { Specialty, UserRole } from "../../generated/prisma/client";
import { auth } from "../../lib/auth";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { ICreateAdminPayload, ICreateDoctorPayload } from "./user.interface"
import status from "http-status"
const createDoctor = async (payload: ICreateDoctorPayload) => {

    const specialties: Specialty[] = [];

    for (const specialtyId of payload.specialties) {
        const specialty = await prisma.specialty.findUnique({
            where: {
                id: specialtyId
            }
        })
        if (!specialty) {
            // throw new Error(`Specialty with id ${specialtyId} not found`);
            throw new AppError(`Specialty with id ${specialtyId} not found`, status.NOT_FOUND,);
        }
        specialties.push(specialty);
    }


    const userExists = await prisma.user.findUnique({
        where: {
            email: payload.doctor.email
        }
    })

    if (userExists) {
        // throw new Error("User with this email already exists");
        throw new AppError("User with this email already exists", status.CONFLICT);
    }

    const userData = await auth.api.signUpEmail({
        body: {
            email: payload.doctor.email,
            password: payload.password,
            role: UserRole.DOCTOR,
            name: payload.doctor.name,
            needPasswordChange: true,
        }
    })


    try {
        const result = await prisma.$transaction(async (tx) => {
            const doctorData = await tx.doctor.create({
                data: {
                    userId: userData.user.id,
                    ...payload.doctor,
                    isDeleted: false
                }
            })

            const doctorSpecialtyData = specialties.map((specialty) => {
                return {
                    doctorId: doctorData.id,
                    specialtyId: specialty.id,
                }
            })

            await tx.doctorSpecialty.createMany({
                data: doctorSpecialtyData
            })

            const doctor = await tx.doctor.findUnique({
                where: {
                    id: doctorData.id
                },
                select: {
                    id: true,
                    userId: true,
                    name: true,
                    email: true,
                    profilePhoto: true,
                    contactNumber: true,
                    address: true,
                    registrationNumber: true,
                    experience: true,
                    gender: true,
                    appointmentFee: true,
                    qualification: true,
                    currentWorkingPlace: true,
                    designation: true,
                    createdAt: true,
                    updatedAt: true,
                    user: {
                        select: {
                            id: true,
                            email: true,
                            name: true,
                            role: true,
                            status: true,
                            emailVerified: true,
                            isDeleted: true,
                            deletedAt: true,
                            createdAt: true,
                            updatedAt: true,
                        }
                    },
                   
                }
            })

            return doctor;

        })




        return result;
    } catch (error) {
        console.log("Transaction error : ", error);
        await prisma.user.delete({
            where: {
                id: userData.user.id
            }
        })
        throw error;
    }
}


const createAdmin = async (payload: ICreateAdminPayload) => {
    //TODO: Validate who is creating the admin user. Only super admin can create admin user and only super admin can create super admin user but admin user cannot create super admin user

    const userExists = await prisma.user.findUnique({
        where: {
            email: payload.admin.email
        }
    })

    if (userExists) {
        throw new AppError( "User with this email already exists",status.CONFLICT);
    }

    const { admin, role, password } = payload;



    const userData = await auth.api.signUpEmail({
        body: {
            ...admin,
            password,
            role,
            needPasswordChange: true,
        }
    })

    try {
        const adminData = await prisma.admin.create({
            data: {
                userId: userData.user.id,
                ...admin,
            }
        })


        
          await redis.del(ADMIN_LIST_CACHE);

        return adminData;


    } catch (error: any) {
        console.log("Error creating admin: ", error);
        await prisma.user.delete({
            where: {
                id: userData.user.id
            }
        })
        throw error;
    }


}


export const userServices = { createDoctor,createAdmin }