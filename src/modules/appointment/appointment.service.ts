import status from "http-status";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { ICreateAppointmentPayload } from "./appointment.interface";
import { QueryBuilder } from "../../utils/queryBuilder";
import { IQueryParams } from "../../types/queryBuilder.types";
import { AppointmentStatus } from "../../generated/prisma/enums";
import { v7 as uuidv7 } from "uuid";
import { stripe } from "../../config/stripe";
import { envConfig } from "../../config/env";
import { ICreatePaymentSession } from "../stripe/stripe.interface";
import { stripeServices } from "../stripe/stripe.service";
import { doctorCacheById } from "../../config/cacheKeys";
import { redis } from "../../config/redis";
/**
 * Get all appointments with filters and pagination (Admin use)
 */
const getAllAppointments = async (queryParams: IQueryParams) => {
    const appointmentsQuery = new QueryBuilder(prisma.appointment, queryParams)
        .include({
            patient: true,
            doctor: true,
            schedule: true,
        })
        .filter(['status', 'paymentStatus'])
        .paginate()
        .sort();

    return await appointmentsQuery.execute();
};

/**
 * Create a new appointment using a transaction
 */
const createAppointment = async (payload: ICreateAppointmentPayload) => {
    const { doctorId, patientId, scheduleId } = payload;
    return await prisma.$transaction(async (tx) => {
        // Validate doctor exists and is active
        const doctor = await tx.doctor.findUnique({
            where: { id: doctorId, isDeleted: false },
        });
        if (!doctor) throw new AppError("Doctor profile not found", status.NOT_FOUND);

        // Validate patient exists
        const patient = await tx.patient.findUnique({
            where: { id: patientId },
        });
        if (!patient) throw new AppError("Patient profile not found", status.NOT_FOUND);

        // Check if doctor schedule exists and is available
        const doctorSchedule = await tx.doctorSchedules.findUnique({
            where: {
                doctorId_scheduleId: { doctorId, scheduleId },
            },
        });

        if (!doctorSchedule) throw new AppError("Schedule not found", status.NOT_FOUND);
        if (doctorSchedule.isBooked) throw new AppError("This schedule is already booked", status.BAD_REQUEST);

        // Create the appointment record
        const appointment = await tx.appointment.create({
            data: {
                ...payload,
                status: AppointmentStatus.SCHEDULED,
            },
            include: {
                patient: true,
                doctor: true,
                schedule: true,
            },
        });
         const transactionId = String(uuidv7());

        const paymentData = await tx.payment.create({
            data : {
                appointmentId : appointment.id,
                amount : doctor.appointmentFee,
                transactionId,
                status:"PENDING",
            }
        });
        
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',
            line_items :[
                {
                    price_data:{
                        currency:"bdt",
                        product_data:{
                            name : `Book Appointment with Dr. ${doctor.name}`,
                        },
                        unit_amount : doctor.appointmentFee * 100,
                    },
                    quantity : 1,
                }
            ],
            metadata:{
                appointmentId : appointment.id,
                paymentId : paymentData.id,
            },

            success_url: `${envConfig.CLIENT_URL}/dashboard/patient/payment/payment-success`,

            // cancel_url: `${envConfig.CLIENT_URL}/dashboard/patient/payment/payment-failed`,
            cancel_url: `${envConfig.CLIENT_URL}/dashboard/patient/appointments`,
        })

        // Mark doctor schedule as booked
        await tx.doctorSchedules.update({
            where: {
                doctorId_scheduleId: { doctorId, scheduleId },
            },
            data: { isBooked: true },
        });

          // 4️⃣ Invalidate caches
          await redis.del(doctorCacheById(doctorId));
        return {
            appointment,
            paymentData,
            paymentUrl:session.url
        }
    });
};
/**
 * Create a new appointment with pay later
 */
const createAppointmentWithPaylater = async (payload: ICreateAppointmentPayload) => {
    const { doctorId, patientId, scheduleId } = payload;
    return await prisma.$transaction(async (tx) => {
        // Validate doctor exists and is active
        const doctor = await tx.doctor.findUnique({
            where: { id: doctorId, isDeleted: false },
        });
        if (!doctor) throw new AppError("Doctor profile not found", status.NOT_FOUND);

        // Validate patient exists
        const patient = await tx.patient.findUnique({
            where: { id: patientId },
        });
        if (!patient) throw new AppError("Patient profile not found", status.NOT_FOUND);

        // Check if doctor schedule exists and is available
        const doctorSchedule = await tx.doctorSchedules.findUnique({
            where: {
                doctorId_scheduleId: { doctorId, scheduleId },
            },
        });

        if (!doctorSchedule) throw new AppError("Schedule not found", status.NOT_FOUND);
        if (doctorSchedule.isBooked) throw new AppError("This schedule is already booked", status.BAD_REQUEST);

        // Create the appointment record
        const appointment = await tx.appointment.create({
            data: {
                ...payload,
                status: AppointmentStatus.SCHEDULED,
            },
            include: {
                patient: true,
                doctor: true,
                schedule: true,
            },
        });
         const transactionId = String(uuidv7());

        const paymentData = await tx.payment.create({
            data : {
                appointmentId : appointment.id,
                amount : doctor.appointmentFee,
                transactionId,
                status:"PENDING",
            }
        });
        // Mark doctor schedule as booked
        await tx.doctorSchedules.update({
            where: {
                doctorId_scheduleId: { doctorId, scheduleId },
            },
            data: { isBooked: true },
        });

        // send paylatar email
        return {
            appointment,
            paymentData
        }
    });
};

/**
 * Get appointments specific to a patient
 */
const getAllMyAppointments = async (userId: string, queryParams: IQueryParams) => {

    const user = await prisma.user.findUnique({
        where:{
            id:userId
        },include:{
            patient:{
                select:{
                    id:true
                }
            }
        }
    })

    if(!user){
        throw new AppError("User not found",status.NOT_FOUND)
    }

    const appointmentQuery = new QueryBuilder(prisma.appointment, queryParams)
        .include({
            patient: true,
            doctor: true,
            schedule: true,
            prescription: true,
            review: true,
            payment: true,
        })
        .filter(["status"])
      
        .paginate()
        .sort();

    // Force filter by userId
    appointmentQuery.query.where = {...appointmentQuery.query.where,
        patientId: user.patient?.id,
        patient:{
            name:{
                contains: queryParams.searchQuery,
                   mode: "insensitive"
            }
        }
};


    const result = await appointmentQuery.execute();

    // if (!result.data || result.data.length === 0) {
    //     throw new AppError("No appointments found for this patient", status.NOT_FOUND);
    // }

    return result;
};

/**
 * Cancel an appointment and free up the doctor's schedule
 */
const cancelAppointment = async (id: string) => {
    return await prisma.$transaction(async (tx) => {
        // Find existing appointment
        const appointment = await tx.appointment.findUnique({
            where: { id },
        });

        if (!appointment) throw new AppError("Appointment not found", status.NOT_FOUND);
        if (appointment.status === AppointmentStatus.CANCELLED) {
            throw new AppError("Appointment already cancelled", status.BAD_REQUEST);
        }

        // Update appointment status to CANCELLED
        const updatedAppointment = await tx.appointment.update({
            where: { id },
            data: { status: AppointmentStatus.CANCELLED },
        });

        // Update doctor schedule to available (isBooked: false)
        await tx.doctorSchedules.update({
            where: {
                doctorId_scheduleId: {
                    doctorId: appointment.doctorId,
                    scheduleId: appointment.scheduleId,
                },
            },
            data: { isBooked: false },
        });

        return updatedAppointment;
    });
};

/**
 * Fetch a single appointment by its unique ID
 */

const getAppointmentById = async (id: string) => {
    const appointment = await prisma.appointment.findUnique({
        where: { id },
        include: {
            patient: true,
            doctor: {
                include: {
                    specialtys: {
                        include: { specialty: true }
                    }
                }
            },
            schedule: true,
            prescription: true,
            review: true,
            payment: true,
        }
    });

    if (!appointment) {
        throw new AppError("Appointment detail not found!", status.NOT_FOUND);
    }

    return appointment;
};

/**
 * handle pay later
 */

const handlePayLater = async (appointmentId:string)=>{

console.log(appointmentId);

   const appointment = await appointmentServices.getAppointmentById(appointmentId);

   if(appointment.status ==="COMPLETED" || appointment.status === "CANCELLED"){
    throw new AppError(`your appoinement is already ${appointment.status}`,400)
   }

   if(appointment.paymentStatus === "COMPLETE"){
       throw new AppError(`your appoinement  payment is already ${appointment.paymentStatus}`,400)

   }

   const sessionPayload:ICreatePaymentSession = {
     doctorname:appointment.doctor.name,
     appointmentFee:appointment.doctor.appointmentFee,
     paymentId:appointment.payment?.id!,
     quantity:1,
     appointmentId
   }
   const {paymentUrl} = await stripeServices.createPaymentSession(sessionPayload);
   return {paymentUrl}
}

export const appointmentServices = {
    getAllAppointments,
    createAppointment,
    getAllMyAppointments,
    cancelAppointment,
    getAppointmentById,
    createAppointmentWithPaylater,
    handlePayLater
};