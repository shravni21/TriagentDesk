import { inngest } from "../client.js";
import Ticket from "../../modals/ticket.js";
import User from "../../modals/user.js";
import { NonRetriableError } from "inngest";
import { sendMail } from "../../utils/mail.js";
import analyzeTicket from "../../utils/ai.js";
import { findBestUserForTicket } from "../../utils/userManagement.js";

export const onTicketCreated = inngest.createFunction(
  { id: "on-ticket-created", retries: 2 },
  { event: "ticket/created" },
  async ({ event, step }) => {
    try {
      console.log("GEMINI API KEY present (backend):", !!process.env.GEMINI_API_KEY);
      console.log("🎯 Inngest function triggered for event:", event.name);
      console.log("Event data:", event.data);
      const { ticketId } = event.data;

      //fetch ticket from DB
      const ticket = await step.run("fetch-ticket", async () => {
        const ticketObject = await Ticket.findById(ticketId);
        if (!ticket) {
          throw new NonRetriableError("Ticket not found");
        }
        return ticketObject;
      });

      await step.run("update-ticket-status", async () => {
        await Ticket.findByIdAndUpdate(ticket._id, { status: "TODO" });
      });

      const relatedskills = await step.run("ai-processing", async () => {
        let skills = [];
        try {
          console.log("Starting AI analysis for ticket:", ticket._id);
          const aiResponse = await analyzeTicket(ticket);
          console.log("AI Response received:", aiResponse);
          
          if (aiResponse && aiResponse.priority && aiResponse.helpfulNotes && aiResponse.relatedSkills) {
            await Ticket.findByIdAndUpdate(ticket._id, {
              priority: !["low", "medium", "high"].includes(aiResponse.priority)
                ? "medium"
                : aiResponse.priority,
              level: aiResponse.level || "L1",
              helpfulNotes: aiResponse.helpfulNotes,
              status: "IN_PROGRESS",
              relatedSkills: aiResponse.relatedSkills,
            });
            skills = aiResponse.relatedSkills;
            console.log("Ticket updated with AI analysis");
          } else {
            console.log("AI response was incomplete, using default values");
            await Ticket.findByIdAndUpdate(ticket._id, {
              priority: "medium",
              level: "L1",
              status: "IN_PROGRESS",
            });
          }
        } catch (aiError) {
          console.error("AI analysis failed:", aiError.message);
          // Set default values if AI fails
          await Ticket.findByIdAndUpdate(ticket._id, {
            priority: "medium",
            level: "L1",
            status: "IN_PROGRESS",
          });
        }
        return skills;
      });

      const moderator = await step.run("assign-moderator", async () => {
        console.log("Looking for best user for ticket with skills:", relatedskills);
        
        // Get the ticket with updated AI analysis to get the level
        const updatedTicket = await Ticket.findById(ticket._id);
        const ticketLevel = updatedTicket.level || "L1";
        
        // Use the smart assignment function
        const assignedUser = await findBestUserForTicket(relatedskills, ticketLevel);
        
        if (assignedUser) {
          await Ticket.findByIdAndUpdate(ticket._id, {
            assignedTo: assignedUser._id
          });
          console.log(`Ticket assigned to: ${assignedUser.email} (${assignedUser.role})`);
        } else {
          console.log("No suitable user found for assignment");
        }
        
        return assignedUser;
      });

      await step.run("send-email-notification", async () => {
        if (moderator) {
          const finalTicket = await Ticket.findById(ticket._id);
          await sendMail(
            moderator.email,
            "Ticket Assigned",
            `A new ticket is assigned to you ${finalTicket.title}`
          );
        }
      });

      return { success: true };
    } catch (err) {
      console.error("❌ Error running the step", err.message);
      return { success: false };
    }
  }
);