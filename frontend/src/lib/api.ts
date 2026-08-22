const API_URL = "/api";

export interface RoleFeedback {
    vote: "RED" | "GREEN" | "YELLOW";
    comment: string;
}

export interface FeedbackResponse {
    verdict: "BLOCKED" | "APPROVED" | "WARNING" | "INQUIRY";
    score: number;
    summary: string;

    questions?: string[]; // For Inquiry Mode

    // Roles
    pm_feedback?: RoleFeedback;
    strategy_feedback?: RoleFeedback;
    growth_feedback?: RoleFeedback;
    tech_feedback?: RoleFeedback;
    user_feedback?: RoleFeedback;
    investor_feedback?: RoleFeedback;

    similar_cases?: string[];
}

export const judgePitch = async (
    pitch: string,
    pitchType: string = "pitch",
    history: string[] = [],
    skipQuestions: boolean = false
): Promise<FeedbackResponse> => {
    const response = await fetch(`${API_URL}/judge`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            pitch_text: pitch,
            pitch_type: pitchType,
            conversation_history: history,
            skipped_questions: skipQuestions
        }),
    });

    if (!response.ok) {
        throw new Error("Judgment failed. The system rejects your request.");
    }

    return response.json();
};
