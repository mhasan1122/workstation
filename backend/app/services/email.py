import logging
import smtplib
from email.message import EmailMessage

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def send_email(to: str, subject: str, html_body: str, text_body: str | None = None) -> None:
    if not settings.smtp_user or not settings.smtp_password:
        raise RuntimeError("SMTP is not configured")

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from or settings.smtp_user
    msg["To"] = to
    msg.set_content(text_body or "Please view this message in an HTML-capable email client.")
    msg.add_alternative(html_body, subtype="html")

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30) as server:
        server.ehlo()
        if settings.smtp_use_tls:
            server.starttls()
            server.ehlo()
        server.login(settings.smtp_user, settings.smtp_password)
        server.send_message(msg)
    logger.info("Email sent to %s (%s)", to, subject)


def send_otp_email(to: str, otp: str, *, purpose: str, name: str | None = None) -> None:
    greeting = f"Hi {name}," if name else "Hi,"
    if purpose == "register":
        title = "Verify your email"
        intro = "Use this one-time code to finish creating your Workstation employee account."
    else:
        title = "Password reset code"
        intro = "Use this one-time code to reset your Workstation account password."

    text = (
        f"{greeting}\n\n{intro}\n\nYour code: {otp}\n\n"
        f"This code expires in {settings.otp_expire_minutes} minutes.\n"
        "If you did not request this, you can ignore this email.\n"
    )
    html = f"""
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0F172A">
      <div style="background:#0B2545;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0">
        <p style="margin:0;font-size:12px;letter-spacing:0.18em;color:#C9A227;text-transform:uppercase">Workstation</p>
        <h1 style="margin:8px 0 0;font-size:22px">{title}</h1>
      </div>
      <div style="border:1px solid #E8EEF5;border-top:0;padding:24px;border-radius:0 0 12px 12px;background:#fff">
        <p style="margin:0 0 12px">{greeting}</p>
        <p style="margin:0 0 20px;color:#5B6B82">{intro}</p>
        <div style="letter-spacing:0.35em;font-size:32px;font-weight:700;text-align:center;
                    background:#F6F8FB;border:1px solid #E8EEF5;border-radius:10px;padding:16px;color:#0B2545">
          {otp}
        </div>
        <p style="margin:20px 0 0;font-size:13px;color:#5B6B82">
          Expires in {settings.otp_expire_minutes} minutes. Do not share this code.
        </p>
      </div>
    </div>
    """
    send_email(to, f"{title} · Workstation", html, text)
