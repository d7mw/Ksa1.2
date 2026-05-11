import os
import logging
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

logger = logging.getLogger(__name__)

API_KEY = os.environ.get('SENDGRID_API_KEY', '')
FROM_EMAIL = os.environ.get('SENDGRID_FROM_EMAIL', '')
FROM_NAME = os.environ.get('SENDGRID_FROM_NAME', 'ksa1')


def send_otp_email(to_email: str, code: str, lang: str = 'ar') -> tuple[bool, str]:
    if not API_KEY or not FROM_EMAIL:
        return False, 'Email service not configured'

    if lang == 'ar':
        subject = f'رمز التحقق في ksa1: {code}'
        html = f'''
        <div style="font-family: Tajawal, Arial, sans-serif; max-width:520px; margin:auto; background:#0a100d; color:#e7e9ea; padding:40px; border-radius:16px; direction:rtl;">
          <h2 style="color:#00a653; margin:0 0 8px;">مرحباً بك في ksa1</h2>
          <p style="color:#9aa0a6; margin:0 0 24px;">رمز التحقق الخاص بك هو:</p>
          <div style="background:#0c1410; border:1px solid #1f2a24; border-radius:12px; padding:24px; text-align:center; font-size:36px; font-weight:bold; letter-spacing:8px; color:#00bf5f;">{code}</div>
          <p style="color:#9aa0a6; font-size:14px; margin-top:24px;">صلاحية الرمز 10 دقائق. إذا لم تطلب هذا الرمز، تجاهل الرسالة.</p>
          <hr style="border:none; border-top:1px solid #1f2a24; margin:24px 0;">
          <p style="color:#5a635c; font-size:12px;">ksa1 · منصة التغريد السعودية</p>
        </div>'''
    else:
        subject = f'Your ksa1 verification code: {code}'
        html = f'''
        <div style="font-family: Inter, Arial, sans-serif; max-width:520px; margin:auto; background:#0a100d; color:#e7e9ea; padding:40px; border-radius:16px;">
          <h2 style="color:#00a653; margin:0 0 8px;">Welcome to ksa1</h2>
          <p style="color:#9aa0a6; margin:0 0 24px;">Your verification code is:</p>
          <div style="background:#0c1410; border:1px solid #1f2a24; border-radius:12px; padding:24px; text-align:center; font-size:36px; font-weight:bold; letter-spacing:8px; color:#00bf5f;">{code}</div>
          <p style="color:#9aa0a6; font-size:14px; margin-top:24px;">Valid for 10 minutes. If you didn\'t request this, ignore this email.</p>
          <hr style="border:none; border-top:1px solid #1f2a24; margin:24px 0;">
          <p style="color:#5a635c; font-size:12px;">ksa1 · Saudi microblogging platform</p>
        </div>'''

    try:
        msg = Mail(from_email=(FROM_EMAIL, FROM_NAME), to_emails=to_email, subject=subject, html_content=html)
        sg = SendGridAPIClient(API_KEY)
        resp = sg.send(msg)
        if resp.status_code in (200, 201, 202):
            return True, 'sent'
        return False, f'SendGrid status {resp.status_code}'
    except Exception as e:
        logger.error(f'SendGrid error: {e}')
        return False, str(e)
