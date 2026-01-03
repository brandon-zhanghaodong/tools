import { GoogleGenAI, Type } from "@google/genai";
import { ReviewAssignment, Question, User, Relationship, EvaluationStatus, UserRole } from "../types";

const MODEL_NAME = "gemini-3-flash-preview"; 

// --- Configuration ---
// [国内用户必读]
// Google API 在国内无法直接访问。如需直连，请配置反向代理地址 (Base URL)。
// 您可以使用 Cloudflare Workers 等服务搭建代理。
// 格式示例: "https://your-proxy-domain.com"
// 如果留空 (undefined)，将使用默认的 Google API 地址 (需要 VPN 环境)
const API_BASE_URL = undefined; 

// Helper to get AI instance
const getAI = () => new GoogleGenAI({ 
  apiKey: process.env.API_KEY,
  baseUrl: API_BASE_URL
});

// Helper to strip markdown code blocks from JSON string
const cleanJson = (text: string | undefined): string => {
  if (!text) return "[]";
  let cleaned = text.trim();
  // Remove markdown code blocks if present
  if (cleaned.includes("```")) {
    cleaned = cleaned.replace(/```(?:json)?/g, "").replace(/```/g, "");
  }
  return cleaned.trim();
};

export const generateFeedbackSummary = async (
  reviews: ReviewAssignment[],
  questions: Question[],
  subjectName: string
): Promise<{ summary: string; strengths: string[]; improvements: string[] }> => {
  try {
    const ai = getAI();

    // Consolidate all qualitative data
    const feedbackTexts = reviews.map((r) => {
      let text = `关系: ${r.relationship}\n`;
      text += `优势方面: ${r.feedbackStrengths}\n`;
      text += `有待提高: ${r.feedbackImprovements}\n`;
      return text;
    });

    const prompt = `
      你是一位资深的人力资源绩效专家。
      请分析员工 "${subjectName}" 的 360 度绩效考核数据。
      
      原始反馈数据:
      ${feedbackTexts.join('\n---\n')}
      
      请提供一个结构化的 JSON 响应：
      1. summary: 一段专业的总结（约 100 字），重点分析自我评价与他人评价的差距（如果有）。
      2. strengths: 提炼 3 个主要优势关键词。
      3. improvements: 提炼 3 个具体的改进建议。
      
      请使用中文回答，语气客观、富有建设性。
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
            improvements: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["summary", "strengths", "improvements"],
        },
      },
    });

    const cleanText = cleanJson(response.text);
    const result = JSON.parse(cleanText) as any;
    return {
      summary: result.summary || "无法生成总结。",
      strengths: Array.isArray(result.strengths) ? result.strengths : [],
      improvements: Array.isArray(result.improvements) ? result.improvements : [],
    };

  } catch (error) {
    console.error("AI Generation Error:", error);
    return {
      summary: "AI 分析服务暂时不可用，请检查网络连接或 API 配置。",
      strengths: [],
      improvements: [],
    };
  }
};

export const generateReviewRelationships = async (
  users: User[],
  cycleId: string,
  organizationId: string
): Promise<ReviewAssignment[]> => {
  try {
    const ai = getAI();

    // Simplify user data for the prompt
    const userContext = users.map(u => ({
      id: u.id,
      name: u.name,
      role: u.role,
      department: u.department,
      managerId: u.managerId
    }));

    const prompt = `
      基于以下员工列表和组织结构，生成一份 360 度绩效考核关系表。
      
      员工数据:
      ${JSON.stringify(userContext, null, 2)}
      
      规则（基于 360 度评估标准流程）：
      1. SELF: 每个人必须评价自己。
      2. MANAGER: 直属经理 (managerId) 评价下属。
      3. DIRECT_REPORT: 下属评价直属经理。
      4. PEER: 同部门的员工互相评价（每人至少分配 2 位平级同事）。
      
      返回一个 JSON 数组，包含每个考核关系的结构：
      { "reviewerId": "...", "subjectId": "...", "relationship": "SELF" | "MANAGER" | "DIRECT_REPORT" | "PEER" }
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              reviewerId: { type: Type.STRING },
              subjectId: { type: Type.STRING },
              relationship: { type: Type.STRING, enum: ["SELF", "MANAGER", "DIRECT_REPORT", "PEER"] },
            },
            required: ["reviewerId", "subjectId", "relationship"],
          },
        },
      },
    });

    const cleanText = cleanJson(response.text);
    const raw = JSON.parse(cleanText);
    const relationships = Array.isArray(raw) ? raw : [];

    return relationships.map((rel: any, index: number) => ({
      id: `ai-gen-${Date.now()}-${index}`,
      organizationId: organizationId,
      cycleId: cycleId,
      reviewerId: rel.reviewerId,
      subjectId: rel.subjectId,
      relationship: rel.relationship as Relationship,
      status: EvaluationStatus.PENDING,
      scores: {},
      comments: {},
      feedbackStrengths: "",
      feedbackImprovements: ""
    }));

  } catch (error) {
    console.error("AI Relationship Gen Error:", error);
    return [];
  }
};

export const parseOrgChartToRelationships = async (
  orgText: string,
  existingUsers: User[],
  cycleId: string,
  organizationId: string,
  filePart?: { mimeType: string, data: string }
): Promise<{ newUsers: Partial<User>[], assignments: ReviewAssignment[] }> => {
  try {
    const ai = getAI();

    const userContext = existingUsers.map(u => ({ id: u.id, name: u.name }));

    // Simplify prompt to avoid confusing the model with Schema constraints on complex multimodal input
    const textPrompt = `
      You are an HR assistant. Parse the provided Org Chart/Roster to identify ALL employees and generate 360-degree review plans.
      
      Current System Users (reuse IDs if matched): ${JSON.stringify(userContext)}
      
      Additional Content: "${orgText}"
      
      Task:
      1. Identify People: Extract names. Use existing IDs if found. Else create new entries (infer role/manager).
      2. Assignments: SELF (everyone), MANAGER (manager->report), DIRECT_REPORT (report->manager), PEER (same team).
      
      Output strictly in JSON format with this structure:
      {
        "newUsers": [ { "id": "...", "name": "...", "role": "MANAGER|EMPLOYEE", "department": "...", "managerId": "..." } ],
        "assignments": [ { "reviewerId": "...", "subjectId": "...", "relationship": "SELF|MANAGER|DIRECT_REPORT|PEER" } ]
      }
    `;

    const parts: any[] = [{ text: textPrompt }];
    
    if (filePart) {
      parts.push({
        inlineData: {
          mimeType: filePart.mimeType,
          data: filePart.data
        }
      });
    }

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        // Removed explicit responseSchema to prevent 500 errors on complex multimodal tasks
      },
    });

    const cleanText = cleanJson(response.text);
    let result: any = {};
    try {
        result = JSON.parse(cleanText);
    } catch (e) {
        console.error("Failed to parse AI JSON response", cleanText);
    }
    
    const assignmentsList = Array.isArray(result.assignments) ? result.assignments : [];
    
    const parsedAssignments = assignmentsList.map((rel: any, index: number) => ({
      id: `ai-import-${Date.now()}-${index}`,
      organizationId: organizationId,
      cycleId: cycleId,
      reviewerId: rel.reviewerId,
      subjectId: rel.subjectId,
      relationship: rel.relationship as Relationship,
      status: EvaluationStatus.PENDING,
      scores: {},
      comments: {},
      feedbackStrengths: "",
      feedbackImprovements: ""
    }));

    return {
      newUsers: Array.isArray(result.newUsers) ? result.newUsers : [],
      assignments: parsedAssignments
    };

  } catch (error) {
    console.error("AI Import Org Chart Error:", error);
    return { newUsers: [], assignments: [] };
  }
};

export const parseUserList = async (
  filePart: { mimeType: string, data: string } | null,
  textData: string
): Promise<Partial<User>[]> => {
  try {
    const ai = getAI();

    const prompt = `
      Parse the following file or text content to extract a list of employees/users.
      
      Input Text: "${textData}"
      
      Return a JSON array:
      [{ "name": "...", "email": "...", "role": "ADMIN|MANAGER|EMPLOYEE", "department": "..." }]
      
      Default role to EMPLOYEE.
    `;

    const parts: any[] = [{ text: prompt }];
    if (filePart) {
      parts.push({
        inlineData: {
          mimeType: filePart.mimeType,
          data: filePart.data
        }
      });
    }

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        // Schema removed for robustness on file inputs
      },
    });

    const cleanText = cleanJson(response.text);
    let raw: any = [];
    try {
        raw = JSON.parse(cleanText);
    } catch (e) {
        console.error("JSON Parse Error", e);
    }
    const users = Array.isArray(raw) ? raw : [];
    
    return users.map((u: any) => ({
      ...u,
      role: (u.role && ["ADMIN", "MANAGER", "EMPLOYEE"].includes(u.role)) ? u.role as UserRole : UserRole.EMPLOYEE
    }));

  } catch (error) {
    console.error("AI Parse User List Error:", error);
    return [];
  }
};

export const generateQuestionnaire = async (): Promise<Question[]> => {
  try {
    const ai = getAI();

    const prompt = `
      请根据《领导力素质模型》设计一套 360 度绩效考核问卷。
      
      设计原则（严格遵守）：
      1. 应用“陈述句式”。
      2. 以第三人称描述，不出现人称代词（如“他/她”），直接描述行为。
      3. 每个问题只描述一个行为点。
      4. 所有问题都是“正向”描述。
      5. 行为必须是具体、可观察、可衡量的。
      
      核心素质维度（请覆盖以下维度）：
      - 诚信正直 (Integrity)
      - 学习创新 (Learning & Innovation)
      - 战略思维 (Strategic Thinking)
      - 组织优化 (Organizational Optimization)
      - 人才开发 (Talent Development)
      
      请生成 10-15 个核心问题。
      
      返回 JSON 数组:
      { "text": "问题描述", "category": "维度名称" }
      请使用中文。
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING },
              category: { type: Type.STRING },
            },
            required: ["text", "category"],
          },
        },
      },
    });

    const cleanText = cleanJson(response.text);
    const raw = JSON.parse(cleanText);
    const questions = Array.isArray(raw) ? raw : [];

    return questions.map((q: any, index: number) => ({
      id: `q-ai-${Date.now()}-${index}`,
      text: q.text,
      category: q.category
    }));

  } catch (error) {
    console.error("AI Question Gen Error:", error);
    return [];
  }
};