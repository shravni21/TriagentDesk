import User from "../modals/user.js";
import Ticket from "../modals/ticket.js";

/**
 * Find the best user to assign a ticket based on skills and workload
 * @param {Array} requiredSkills - Skills required for the ticket
 * @param {String} ticketLevel - L1, L2, or L3
 * @returns {Object|null} - Best matching user or null
 */
export const findBestUserForTicket = async (requiredSkills, ticketLevel = "L1") => {
  try {
    console.log(`Finding best user for ticket with skills: ${requiredSkills}, level: ${ticketLevel}`);
    
    // Get all available moderators and admins
    const availableUsers = await User.find({
      role: { $in: ["moderator", "admin"] }
    });
    
    if (availableUsers.length === 0) {
      console.log("No moderators or admins found");
      return null;
    }
    
    // Calculate score for each user based on skills and workload
    const userScores = [];
    
    for (const user of availableUsers) {
      let score = 0;
      const matchingSkills = [];
      
      // Skill matching score
      if (requiredSkills && requiredSkills.length > 0 && user.skills && user.skills.length > 0) {
        for (const ticketSkill of requiredSkills) {
          for (const userSkill of user.skills) {
            if (userSkill.toLowerCase().includes(ticketSkill.toLowerCase()) ||
                ticketSkill.toLowerCase().includes(userSkill.toLowerCase())) {
              matchingSkills.push(userSkill);
              score += 10; // 10 points per matching skill
              break;
            }
          }
        }
      }
      
      // Level matching bonus
      if (ticketLevel === "L3" && user.skills && user.skills.length >= 5) {
        score += 5; // Bonus for experienced users on complex tickets
      } else if (ticketLevel === "L1" && user.skills && user.skills.length <= 3) {
        score += 3; // Bonus for junior users on simple tickets
      }
      
      // Role preference (admin gets slight preference for complex tickets)
      if (user.role === "admin" && ticketLevel === "L3") {
        score += 2;
      }
      
      // Workload consideration (fewer active tickets = higher score)
      const activeTickets = await Ticket.countDocuments({
        assignedTo: user._id,
        status: { $in: ["TODO", "IN_PROGRESS"] }
      });
      
      score -= activeTickets * 2; // Reduce score based on current workload
      
      userScores.push({
        user,
        score,
        matchingSkills,
        activeTickets
      });
      
      console.log(`User ${user.email}: score=${score}, matchingSkills=${matchingSkills.length}, activeTickets=${activeTickets}`);
    }
    
    // Sort by score (highest first) and return the best match
    userScores.sort((a, b) => b.score - a.score);
    
    if (userScores.length > 0 && userScores[0].score > 0) {
      const bestMatch = userScores[0];
      console.log(`Best match: ${bestMatch.user.email} with score ${bestMatch.score}`);
      return bestMatch.user;
    }
    
    // If no good skill match, return user with lowest workload
    userScores.sort((a, b) => a.activeTickets - b.activeTickets);
    console.log(`No skill match found, assigning to user with lowest workload: ${userScores[0].user.email}`);
    return userScores[0].user;
    
  } catch (error) {
    console.error("Error finding best user for ticket:", error);
    return null;
  }
};

/**
 * Get user statistics for dashboard
 * @param {String} userId - User ID
 * @returns {Object} - User statistics
 */
export const getUserStats = async (userId) => {
  try {
    const totalTickets = await Ticket.countDocuments({ assignedTo: userId });
    const activeTickets = await Ticket.countDocuments({
      assignedTo: userId,
      status: { $in: ["TODO", "IN_PROGRESS"] }
    });
    const completedTickets = await Ticket.countDocuments({
      assignedTo: userId,
      status: "DONE"
    });
    
    return {
      totalTickets,
      activeTickets,
      completedTickets,
      completionRate: totalTickets > 0 ? (completedTickets / totalTickets * 100).toFixed(1) : 0
    };
  } catch (error) {
    console.error("Error getting user stats:", error);
    return { totalTickets: 0, activeTickets: 0, completedTickets: 0, completionRate: 0 };
  }
};

/**
 * Get all users with their skills and current workload
 * @returns {Array} - Array of users with stats
 */
export const getAllUsersWithStats = async () => {
  try {
    const users = await User.find({ role: { $in: ["moderator", "admin"] } });
    const usersWithStats = [];
    
    for (const user of users) {
      const stats = await getUserStats(user._id);
      usersWithStats.push({
        _id: user._id,
        email: user.email,
        role: user.role,
        skills: user.skills,
        ...stats
      });
    }
    
    return usersWithStats;
  } catch (error) {
    console.error("Error getting users with stats:", error);
    return [];
  }
}; 