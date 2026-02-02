import { Resend } from 'resend';

// 延迟初始化 Resend 客户端
let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY is not configured');
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

const FROM_EMAIL = 'ProductThink <noreply@vivi.wiki>';
const CONTACT_EMAIL = 'mengjie.xiao@outlook.com';
const LOGO_URL = 'https://productthink.vivi.wiki/avatars/bot-avatar.jpg';

// Notion 风格配色
const COLORS = {
  background: '#ffffff',
  text: '#37352f',
  textSecondary: '#9b9a97',
  border: '#e3e3e0',
  codeBg: '#f7f7f5',
};

/**
 * 生成验证码邮件 HTML
 */
function generateVerificationEmailHtml(code: string, type: 'register' | 'reset_password'): string {
  const title = type === 'register' ? '欢迎注册 ProductThink' : '重置您的密码';
  const description = type === 'register'
    ? '您正在注册 ProductThink 账号，验证码为：'
    : '您正在重置密码，验证码为：';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${COLORS.background}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: ${COLORS.background};">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 500px;">

          <!-- Logo 和标题 -->
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <img src="${LOGO_URL}" alt="ProductThink" width="64" height="64" style="border-radius: 50%; margin-bottom: 16px;">
              <h1 style="margin: 0; font-size: 20px; font-weight: 600; color: ${COLORS.text};">产品咨询顾问团 ProductThink</h1>
            </td>
          </tr>

          <!-- 分割线 -->
          <tr>
            <td style="border-top: 1px solid ${COLORS.border}; padding-top: 32px;"></td>
          </tr>

          <!-- 正文 -->
          <tr>
            <td style="color: ${COLORS.text}; font-size: 15px; line-height: 1.6;">
              <p style="margin: 0 0 16px 0;">您好！</p>
              <p style="margin: 0 0 24px 0;">${description}</p>
            </td>
          </tr>

          <!-- 验证码 -->
          <tr>
            <td align="center" style="padding: 24px 0;">
              <div style="display: inline-block; background-color: ${COLORS.codeBg}; border: 1px solid ${COLORS.border}; border-radius: 8px; padding: 20px 40px;">
                <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: ${COLORS.text};">${code}</span>
              </div>
            </td>
          </tr>

          <!-- 提示信息 -->
          <tr>
            <td style="color: ${COLORS.textSecondary}; font-size: 14px; line-height: 1.6; padding: 16px 0 32px 0;">
              <p style="margin: 0 0 8px 0;">⏱ 验证码有效期为 10 分钟，请尽快使用。</p>
              <p style="margin: 0;">🔒 如果这不是您本人的操作，请忽略此邮件。</p>
            </td>
          </tr>

          <!-- 分割线 -->
          <tr>
            <td style="border-top: 1px solid ${COLORS.border}; padding-top: 32px;"></td>
          </tr>

          <!-- 产品介绍 -->
          <tr>
            <td style="color: ${COLORS.text}; font-size: 14px; line-height: 1.8;">
              <p style="margin: 0 0 16px 0; font-weight: 600;">💡 关于 ProductThink</p>
              <p style="margin: 0 0 16px 0; color: ${COLORS.textSecondary};">
                一个 AI 产品顾问团，把长期学习和吸收的产品思维（来自 Lenny、梁宁、张一鸣等），变成随时在你身边的产品咨询顾问。
              </p>
              <p style="margin: 0 0 24px 0; color: ${COLORS.text}; font-style: italic;">
                核心理念：在真正开始 Vibe Coding 写产品之前，先把产品想清楚。
              </p>
            </td>
          </tr>

          <!-- 核心功能 -->
          <tr>
            <td style="color: ${COLORS.text}; font-size: 14px; line-height: 1.8;">
              <p style="margin: 0 0 16px 0; font-weight: 600;">🎯 它主要做三件事</p>
              <table cellpadding="0" cellspacing="0" style="color: ${COLORS.textSecondary};">
                <tr>
                  <td style="padding: 0 0 12px 0; vertical-align: top;">
                    <strong style="color: ${COLORS.text};">• AI 产品顾问对话</strong><br>
                    <span style="padding-left: 12px;">一步步追问你的想法，帮你澄清产品定位、目标用户和核心价值</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 0 0 12px 0; vertical-align: top;">
                    <strong style="color: ${COLORS.text};">• 多视角圆桌分析</strong><br>
                    <span style="padding-left: 12px;">从产品、增长、投资人和目标用户等视角，系统性给出反馈，生成可下载的 PDF 产品评估报告</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 0 0 12px 0; vertical-align: top;">
                    <strong style="color: ${COLORS.text};">• Sparks 灵感页面</strong><br>
                    <span style="padding-left: 12px;">把优质的产品访谈、播客和文章拆解成可以直接拿走的观点卡片</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- 分割线 -->
          <tr>
            <td style="border-top: 1px solid ${COLORS.border}; padding-top: 24px; margin-top: 24px;"></td>
          </tr>

          <!-- 底部信息 -->
          <tr>
            <td align="center" style="color: ${COLORS.textSecondary}; font-size: 12px; line-height: 1.6; padding-top: 8px;">
              <p style="margin: 0 0 8px 0;">此邮件由系统自动发送，请勿直接回复。</p>
              <p style="margin: 0 0 16px 0;">如有问题，请联系：${CONTACT_EMAIL}</p>
              <p style="margin: 0; color: ${COLORS.text};">───────────────────────────</p>
              <p style="margin: 8px 0 0 0; color: ${COLORS.text}; font-style: italic;">让每一个产品想法都值得被认真对待</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

/**
 * 生成纯文本邮件内容
 */
function generateVerificationEmailText(code: string, type: 'register' | 'reset_password'): string {
  const description = type === 'register'
    ? '您正在注册 ProductThink 账号'
    : '您正在重置密码';

  return `
您好！

${description}，验证码为：${code}

⏱ 验证码有效期为 10 分钟，请尽快使用。
🔒 如果这不是您本人的操作，请忽略此邮件。

───────────────────────────

💡 关于 ProductThink

一个 AI 产品顾问团，把长期学习和吸收的产品思维（来自 Lenny、梁宁、张一鸣等），变成随时在你身边的产品咨询顾问。

核心理念：在真正开始 Vibe Coding 写产品之前，先把产品想清楚。

🎯 它主要做三件事

• AI 产品顾问对话
  一步步追问你的想法，帮你澄清产品定位、目标用户和核心价值

• 多视角圆桌分析
  从产品、增长、投资人和目标用户等视角，系统性给出反馈，生成可下载的 PDF 产品评估报告

• Sparks 灵感页面
  把优质的产品访谈、播客和文章拆解成可以直接拿走的观点卡片

───────────────────────────

此邮件由系统自动发送，请勿直接回复。
如有问题，请联系：${CONTACT_EMAIL}

让每一个产品想法都值得被认真对待
`;
}

/**
 * 发送验证码邮件
 */
export async function sendVerificationEmail(
  email: string,
  code: string,
  type: 'register' | 'reset_password'
): Promise<{ success: boolean; error?: string }> {
  const subject = type === 'register'
    ? `【ProductThink】您的注册验证码：${code}`
    : `【ProductThink】您的密码重置验证码：${code}`;

  try {
    const resend = getResendClient();
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject,
      html: generateVerificationEmailHtml(code, type),
      text: generateVerificationEmailText(code, type),
    });

    if (error) {
      console.error('Failed to send email:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('Email sending error:', err);
    const errorMessage = err instanceof Error ? err.message : '邮件发送失败，请稍后重试';
    return { success: false, error: errorMessage };
  }
}

/**
 * 生成 6 位数字验证码
 */
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
