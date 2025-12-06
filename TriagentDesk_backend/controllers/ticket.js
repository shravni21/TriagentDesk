import { inngest } from "../inggest/client.js";
import Ticket from "../modals/ticket.js";
import User from "../modals/user.js";
import analyzeTicket, { testGeminiAPI } from "../utils/ai.js";
import { sendTicketCreationEmail, sendTicketAssignmentEmail } from "../utils/mail.js";
import { findBestUserForTicket } from "../utils/userManagement.js";

export const createTicket = async (req, res) => {
  try {
    console.log("Ticket creation request received");
    console.log("Request body:", req.body);
    console.log("User:", req.user);
    
    const { title, description } = req.body;
    if (!title || !description) {
      console.log("Missing title or description");
      return res
        .status(400)
        .json({ message: "Title and description are required" });
    }
    
    console.log("Creating ticket with data:", { title, description, createdBy: req.user._id });
    const newTicket = await Ticket.create({
      title,
      description,
      createdBy: req.user._id.toString(),
    });
    console.log("Ticket created successfully:", newTicket._id);

    // Process AI immediately instead of relying on Inngest
    let updatedTicket = newTicket;
    try {
      console.log("Processing AI for ticket:", newTicket._id);
      const aiResponse = await analyzeTicket(newTicket);
      console.log("AI Response received:", aiResponse);
      
      if (aiResponse && aiResponse.priority && aiResponse.helpfulNotes && aiResponse.relatedSkills) {
        const updateData = {
          priority: aiResponse.priority,
          level: aiResponse.level || "L1",
          helpfulNotes: aiResponse.helpfulNotes,
          relatedSkills: aiResponse.relatedSkills,
          status: "IN_PROGRESS"
        };
        
        await Ticket.findByIdAndUpdate(newTicket._id, updateData);
        console.log("Ticket updated with AI analysis");
        
        // Get the updated ticket
        updatedTicket = await Ticket.findById(newTicket._id).populate("assignedTo", ["email", "_id"]);
        
        // Smart assignment based on skills and availability
        const relatedSkills = aiResponse.relatedSkills;
        const ticketLevel = aiResponse.level || "L1";
        
        // Use the smart assignment function
        const assignedUser = await findBestUserForTicket(relatedSkills, ticketLevel);
        
        if (assignedUser) {
          await Ticket.findByIdAndUpdate(newTicket._id, {
            assignedTo: assignedUser._id
          });
          console.log(`Ticket assigned to: ${assignedUser.email} (${assignedUser.role})`);
          
          // Update the ticket object with assignment
          updatedTicket.assignedTo = assignedUser;
          
          // Send email notification to assigned user
          try {
            await sendTicketAssignmentEmail(updatedTicket, assignedUser);
          } catch (emailError) {
            console.error("Failed to send assignment email:", emailError.message);
          }
        } else {
          console.log("No suitable user found for assignment");
        }
        
        // Send ticket creation notification
        try {
          await sendTicketCreationEmail(updatedTicket, assignedUser);
        } catch (emailError) {
          console.error("Failed to send creation email:", emailError.message);
        }
      } else {
        console.error("AI response incomplete:", aiResponse);
        // Still try to assign even if AI fails
        const assignedUser = await findBestUserForTicket([], "L1");
        if (assignedUser) {
          await Ticket.findByIdAndUpdate(newTicket._id, {
            assignedTo: assignedUser._id
          });
          updatedTicket.assignedTo = assignedUser;
        }
      }
    } catch (aiError) {
      console.error("AI processing failed:", aiError.message);
      console.error("Full AI error:", aiError);
      // Still try to assign even if AI fails
      const assignedUser = await findBestUserForTicket([], "L1");
      if (assignedUser) {
        await Ticket.findByIdAndUpdate(newTicket._id, {
          assignedTo: assignedUser._id
        });
        updatedTicket.assignedTo = assignedUser;
      }
    }

    // Also try Inngest as backup
    try {
      console.log("Sending Inngest event for ticket:", newTicket._id);
      const eventResult = await inngest.send({
        name: "ticket/created",
        data: {
          ticketId: newTicket._id.toString(),
          title,
          description,
          createdBy: req.user._id.toString(),
        },
      });
      console.log("Inngest event sent successfully:", eventResult);
    } catch (inngestError) {
      console.error("Inngest event failed:", inngestError.message);
    }
    
    return res.status(201).json({
      message: "Ticket created and AI processing completed",
      ticket: updatedTicket,
    });
  } catch (error) {
    console.error("Error creating ticket:", error.message);
    console.error("Full error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

export const getTickets = async (req, res) => {
  try {
    const user = req.user;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    let tickets = [];
    let totalTickets = 0;
    
    if (user.role !== "user") {
      // Admin/Moderator: Get all tickets with pagination
      totalTickets = await Ticket.countDocuments({});
      tickets = await Ticket.find({})
        .populate("assignedTo", ["email", "_id"])
        .populate("createdBy", ["email", "_id"])
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
    } else {
      // Regular user: Get only tickets assigned to them
      totalTickets = await Ticket.countDocuments({ assignedTo: user._id });
      tickets = await Ticket.find({ assignedTo: user._id })
        .select("title description status createdAt priority helpfulNotes relatedSkills assignedTo level createdBy")
        .populate("assignedTo", ["email", "_id"])
        .populate("createdBy", ["email", "_id"])
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
    }
    
    const totalPages = Math.ceil(totalTickets / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;
    
    return res.status(200).json({
      tickets,
      pagination: {
        currentPage: page,
        totalPages,
        totalTickets,
        hasNextPage,
        hasPrevPage,
        limit
      }
    });
  } catch (error) {
    console.error("Error fetching tickets", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getTicket = async (req, res) => {
  try {
    const user = req.user;
    let ticket;

    if (user.role !== "user") {
      // Admin/Moderator: Can access any ticket
      ticket = await Ticket.findById(req.params.id)
        .populate("assignedTo", ["email", "_id"])
        .populate("createdBy", ["email", "_id"]);
    } else {
      // Regular user: Can only access tickets assigned to them
      ticket = await Ticket.findOne({
        _id: req.params.id,
        assignedTo: user._id,
      })
        .select("title description status createdAt priority helpfulNotes relatedSkills assignedTo level createdBy")
        .populate("assignedTo", ["email", "_id"])
        .populate("createdBy", ["email", "_id"]);
    }

    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found or access denied" });
    }
    return res.status(200).json({ ticket });
  } catch (error) {
    console.error("Error fetching ticket", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateTicketStatus = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { status } = req.body;
    const user = req.user;

    // Validate status
    const validStatuses = ["TODO", "IN_PROGRESS", "DONE"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        message: "Invalid status. Must be one of: TODO, IN_PROGRESS, DONE" 
      });
    }

    // Find the ticket
    let ticket;
    if (user.role !== "user") {
      // Admin/Moderator can update any ticket
      ticket = await Ticket.findById(ticketId);
    } else {
      // Regular user can only update their own tickets
      ticket = await Ticket.findOne({
        _id: ticketId,
        createdBy: user._id
      });
    }

    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found or access denied" });
    }

    // Update the ticket status
    const updatedTicket = await Ticket.findByIdAndUpdate(
      ticketId,
      { status },
      { new: true }
    ).populate("assignedTo", ["email", "_id"]);

    console.log(`Ticket ${ticketId} status updated to ${status} by ${user.email}`);

    return res.status(200).json({
      message: "Ticket status updated successfully",
      ticket: updatedTicket
    });

  } catch (error) {
    console.error("Error updating ticket status:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const checkAIConfig = async (req, res) => {
  try {
    const hasApiKey = !!process.env.GEMINI_API_KEY;
    const apiKeyStatus = hasApiKey ? "Configured" : "Missing";
    
    return res.status(200).json({
      aiConfigured: hasApiKey,
      apiKeyStatus,
      message: hasApiKey ? "AI is properly configured" : "GEMINI_API_KEY is missing from environment variables"
    });
  } catch (error) {
    console.error("Error checking AI config:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const testAI = async (req, res) => {
  try {
    console.log("Testing AI functionality...");
    
    // First test basic Gemini API connection
    console.log("Step 1: Testing basic Gemini API...");
    const basicTest = await testGeminiAPI();
    
    if (!basicTest.success) {
      return res.status(500).json({
        success: false,
        message: "Basic Gemini API test failed",
        error: basicTest.error
      });
    }
    
    console.log("Step 2: Testing full ticket analysis...");
    
    // Create a test ticket object
    const testTicket = {
      title: "Test: Login button not working",
      description: "Users cannot log in to the application. The login button is not responding when clicked."
    };
    
    console.log("Test ticket:", testTicket);
    
    const aiResponse = await analyzeTicket(testTicket);
    console.log("AI test response:", aiResponse);
    
    if (aiResponse) {
      return res.status(200).json({
        success: true,
        message: "AI is working correctly",
        basicTest: basicTest.success,
        testTicket,
        aiResponse
      });
    } else {
      return res.status(500).json({
        success: false,
        message: "AI processing failed",
        basicTest: basicTest.success,
        testTicket
      });
    }
  } catch (error) {
    console.error("AI test failed:", error.message);
    return res.status(500).json({
      success: false,
      message: "AI test failed",
      error: error.message
    });
  }
};

export const getDashboardStats = async (req, res) => {
  try {
    // Only admins can access dashboard stats
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied. Admin only." });
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get ticket counts by time period
    const todayTickets = await Ticket.countDocuments({
      createdAt: { $gte: today }
    });

    const weekTickets = await Ticket.countDocuments({
      createdAt: { $gte: weekAgo }
    });

    const monthTickets = await Ticket.countDocuments({
      createdAt: { $gte: monthAgo }
    });

    const totalTickets = await Ticket.countDocuments({});

    // Get status breakdown
    const statusBreakdown = await Ticket.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]);

    // Get priority breakdown
    const priorityBreakdown = await Ticket.aggregate([
      {
        $group: {
          _id: "$priority",
          count: { $sum: 1 }
        }
      }
    ]);

    // Get level breakdown
    const levelBreakdown = await Ticket.aggregate([
      {
        $group: {
          _id: "$level",
          count: { $sum: 1 }
        }
      }
    ]);

    // Get team member assignments
    const teamAssignments = await Ticket.aggregate([
      {
        $lookup: {
          from: "users",
          localField: "assignedTo",
          foreignField: "_id",
          as: "assignedUser"
        }
      },
      {
        $unwind: "$assignedUser"
      },
      {
        $group: {
          _id: "$assignedUser.email",
          totalAssigned: { $sum: 1 },
          todo: {
            $sum: { $cond: [{ $eq: ["$status", "TODO"] }, 1, 0] }
          },
          inProgress: {
            $sum: { $cond: [{ $eq: ["$status", "IN_PROGRESS"] }, 1, 0] }
          },
          done: {
            $sum: { $cond: [{ $eq: ["$status", "DONE"] }, 1, 0] }
          }
        }
      },
      {
        $sort: { totalAssigned: -1 }
      }
    ]);

    // Get recent tickets (last 10)
    const recentTickets = await Ticket.find({})
      .populate("assignedTo", ["email", "_id"])
      .populate("createdBy", ["email", "_id"])
      .sort({ createdAt: -1 })
      .limit(10);

    // Get tickets by day for the last 7 days
    const dailyStats = await Ticket.aggregate([
      {
        $match: {
          createdAt: { $gte: weekAgo }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Calculate resolution rate
    const resolvedTickets = await Ticket.countDocuments({ status: "DONE" });
    const resolutionRate = totalTickets > 0 ? (resolvedTickets / totalTickets * 100).toFixed(1) : 0;

    // Get average resolution time (for completed tickets)
    const avgResolutionTime = await Ticket.aggregate([
      {
        $match: { status: "DONE" }
      },
      {
        $addFields: {
          resolutionTime: {
            $divide: [
              { $subtract: ["$updatedAt", "$createdAt"] },
              1000 * 60 * 60 * 24 // Convert to days
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          avgDays: { $avg: "$resolutionTime" }
        }
      }
    ]);

    const stats = {
      overview: {
        totalTickets,
        todayTickets,
        weekTickets,
        monthTickets,
        resolvedTickets,
        resolutionRate: parseFloat(resolutionRate),
        avgResolutionDays: avgResolutionTime.length > 0 ? Math.round(avgResolutionTime[0].avgDays * 10) / 10 : 0
      },
      statusBreakdown: statusBreakdown.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      priorityBreakdown: priorityBreakdown.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      levelBreakdown: levelBreakdown.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      teamAssignments,
      recentTickets,
      dailyStats
    };

    return res.status(200).json(stats);
  } catch (error) {
    console.error("Error fetching dashboard stats:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};