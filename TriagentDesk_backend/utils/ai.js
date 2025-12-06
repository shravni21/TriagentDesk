import { createAgent, gemini } from "@inngest/agent-kit";

// Simple test function to verify Gemini API
export const testGeminiAPI = async () => {
  try {
    console.log("Testing Gemini API directly...");
    
    if (!process.env.GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY not found");
      return { success: false, error: "API key missing" };
    }
    
    // Create a simple agent for testing
    const testAgent = createAgent({
      model: gemini({
        model: "gemini-1.5-flash-8b",
        apiKey: process.env.GEMINI_API_KEY,
      }),
      name: "Test Agent",
      system: "You are a helpful assistant. Respond with a simple JSON object.",
    });
    
    const response = await testAgent.run("Return a JSON object with a simple message: { 'message': 'Hello World' }");
    console.log("Test response:", response);
    
    return { success: true, response };
  } catch (error) {
    console.error("Gemini API test failed:", error);
    return { success: false, error: error.message };
  }
};

const analyzeTicket = async (ticket) => {
  try {
    console.log("Starting AI analysis for ticket:", ticket.title);
    console.log("Using GEMINI_API_KEY:", process.env.GEMINI_API_KEY ? "Key exists" : "No key found");
    
    if (!process.env.GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY not found in environment variables");
      console.error("Please set GEMINI_API_KEY in your .env file");
      return null;
    }

    console.log("Creating AI agent...");
    const supportAgent = createAgent({
      model: gemini({
        model: "gemini-2.5-flash",
        apiKey: process.env.GEMINI_API_KEY,
      }),
      name: "AI Ticket Triage Assistant",
      system: `You are an expert technical support specialist with deep knowledge of web development, databases, APIs, and troubleshooting. 

Your job is to:
1. Summarize the issue clearly and concisely.
2. Estimate its priority based on impact and urgency using these criteria:
   - HIGH: Critical issues affecting core functionality, security vulnerabilities, data loss, complete system failure, or issues affecting multiple users
   - MEDIUM: Important features not working, performance issues, UI/UX problems, or issues affecting single users but with workarounds
   - LOW: Minor bugs, cosmetic issues, enhancement requests, or non-critical features
3. Provide EXTREMELY DETAILED helpful notes that include:
   - Step-by-step troubleshooting procedures
   - Common causes and solutions
   - Specific code examples or commands when relevant
   - Links to official documentation, Stack Overflow, or GitHub issues
   - Environment-specific considerations (browser, OS, version compatibility)
   - Debugging techniques and tools
   - Alternative approaches or workarounds
4. List all relevant technical skills required to solve the issue.

IMPORTANT:
- Respond with *only* valid raw JSON.
- Do NOT include markdown, code fences, comments, or any extra formatting.
- The format must be a raw JSON object.
- Be extremely detailed in helpfulNotes - this should be comprehensive enough for a human moderator to solve the issue.

Repeat: Do not wrap your output in markdown or code fences.`,
    });

    console.log("Running AI analysis...");
    const response = await supportAgent.run(`You are a ticket triage agent. Only return a strict JSON object with no extra text, headers, or markdown.
        
Analyze the following support ticket and provide a JSON object with:

- summary: A short 1-2 sentence summary of the issue.
- priority: One of "low", "medium", or "high" based on these criteria:
  * HIGH: Critical issues affecting core functionality, security vulnerabilities, data loss, complete system failure, or issues affecting multiple users
  * MEDIUM: Important features not working, performance issues, UI/UX problems, or issues affecting single users but with workarounds
  * LOW: Minor bugs, cosmetic issues, enhancement requests, or non-critical features
- level: One of "L1", "L2", or "L3" based on these criteria:
  * L1: Basic issues that can be resolved with simple troubleshooting, password resets, basic configuration, common user errors, or issues with clear documented solutions
  * L2: Intermediate issues requiring technical knowledge, code debugging, API troubleshooting, database queries, performance optimization, or integration problems
  * L3: Complex issues requiring deep technical expertise, architectural changes, security analysis, custom development, system-wide changes, or issues affecting multiple systems
- helpfulNotes: EXTREMELY DETAILED technical explanation that includes:
  * Step-by-step troubleshooting procedures
  * Common causes and their solutions
  * Specific code examples, commands, or configuration changes
  * Links to relevant documentation, Stack Overflow posts, or GitHub issues
  * Environment-specific considerations (browser versions, OS, dependencies)
  * Debugging techniques and tools to use
  * Alternative approaches or workarounds
  * Expected outcomes and how to verify the fix
  * Any potential side effects or additional steps needed
- relatedSkills: An array of relevant skills required to solve the issue (e.g., ["React", "MongoDB", "Node.js", "API Integration"]).

The helpfulNotes should be comprehensive enough that a human moderator with basic technical knowledge could follow the steps and resolve the issue.

Respond ONLY in this JSON format and do not include any other text or markdown in the answer:

{
"summary": "Short summary of the ticket",
"priority": "high",
"level": "L2",
"helpfulNotes": "DETAILED step-by-step troubleshooting guide with specific commands, code examples, and resource links...",
"relatedSkills": ["React", "Node.js", "MongoDB"]
}

---

Ticket information:

- Title: ${ticket.title}
- Description: ${ticket.description}`);

    console.log("Raw AI response:", response);
    console.log("Response output:", response.output);
    console.log("Response type:", typeof response);
    console.log("Response keys:", Object.keys(response));
    
    // Handle different response formats
    let raw = "";
    
    // Try multiple response format patterns
    if (response.output && Array.isArray(response.output) && response.output.length > 0) {
      const firstOutput = response.output[0];
      console.log("First output item:", firstOutput);
      console.log("First output keys:", Object.keys(firstOutput));
      
      if (firstOutput.context) {
        raw = firstOutput.context;
        console.log("Using context from output[0]");
      } else if (firstOutput.content) {
        raw = firstOutput.content;
        console.log("Using content from output[0]");
      } else if (firstOutput.text) {
        raw = firstOutput.text;
        console.log("Using text from output[0]");
      } else if (typeof firstOutput === 'string') {
        raw = firstOutput;
        console.log("Using string from output[0]");
      }
    } else if (response.output && typeof response.output === 'string') {
      raw = response.output;
      console.log("Using string output");
    } else if (response.content) {
      raw = response.content;
      console.log("Using content from response");
    } else if (response.text) {
      raw = response.text;
      console.log("Using text from response");
    } else if (typeof response === 'string') {
      raw = response;
      console.log("Using response as string");
    } else {
      console.error("Unexpected response format:", JSON.stringify(response, null, 2));
      return null;
    }
    
    console.log("Extracted raw text:", raw);
    
    if (!raw || raw.trim().length === 0) {
      console.error("No content extracted from AI response");
      return null;
    }

    // Try multiple parsing strategies
    let jsonString = raw.trim();
    
    // Remove markdown code blocks if present
    const markdownMatch = raw.match(/```json\s*([\s\S]*?)\s*```/i);
    if (markdownMatch) {
      jsonString = markdownMatch[1].trim();
      console.log("Extracted JSON from markdown block");
    }
    
    // Remove any leading/trailing non-JSON text
    const jsonStart = jsonString.indexOf('{');
    const jsonEnd = jsonString.lastIndexOf('}') + 1;
    if (jsonStart !== -1 && jsonEnd > jsonStart) {
      jsonString = jsonString.substring(jsonStart, jsonEnd);
      console.log("Extracted JSON from text boundaries");
    }
    
    console.log("Final JSON string to parse:", jsonString);
    
    try {
      const result = JSON.parse(jsonString);
      console.log("Successfully parsed AI response:", result);
      
      // Validate required fields
      if (!result.priority || !result.helpfulNotes || !result.relatedSkills) {
        console.error("AI response missing required fields:", {
          hasPriority: !!result.priority,
          hasHelpfulNotes: !!result.helpfulNotes,
          hasRelatedSkills: !!result.relatedSkills
        });
        return null;
      }
      
      return result;
    } catch (parseError) {
      console.error("JSON parsing failed:", parseError.message);
      console.error("Failed JSON string:", jsonString);
      
      // Try to extract JSON using regex as last resort
      try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const fallbackResult = JSON.parse(jsonMatch[0]);
          console.log("Fallback JSON parsing successful:", fallbackResult);
          return fallbackResult;
        }
      } catch (fallbackError) {
        console.error("Fallback parsing also failed:", fallbackError.message);
      }
      
      return null;
    }
    
  } catch (e) {
    console.error("Failed to analyze ticket with AI:", e.message);
    console.error("Full error:", e);
    return null;
  }
};

export default analyzeTicket;