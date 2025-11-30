# server/app/email_utils.py

from __future__ import annotations

import os
import smtplib
from email.message import EmailMessage
from dotenv import load_dotenv

load_dotenv()

# SMTP Config
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASS = os.getenv("SMTP_PASS")

# Sender identity
MAIL_FROM = os.getenv("MAIL_FROM", "MusicRec <noreply@musicrec.local>")

# Backend + Frontend URLs
BACKEND_BASE_URL = os.getenv("BACKEND_BASE_URL", "http://localhost:8000")
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:3000")

EMAIL_ENABLED = os.getenv("EMAIL_ENABLED", "false").lower() == "true"


def _send_email(to_email: str, subject: str, html_body: str) -> None:
    """Low-level SMTP sender with STARTTLS + fail-safe logging."""

    if not EMAIL_ENABLED:
        print(f"[email_utils] EMAIL_ENABLED = false — skipping send to {to_email}")
        print(f"[Subject] {subject}")
        print(f"[HTML Body]\n{html_body}")
        return

    if not SMTP_USER or not SMTP_PASS:
        print("[email_utils] Missing SMTP credentials — cannot send email.")
        return

    msg = EmailMessage()
    msg["From"] = MAIL_FROM
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content("This email contains HTML content.")
    msg.add_alternative(html_body, subtype="html")

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.send_message(msg)
            print(f"[email_utils] Email sent → {to_email}")
    except Exception as exc:
        print(f"[email_utils] ERROR sending email to {to_email}: {exc}")


def send_verification_email(to_email: str, token: str) -> None:
    """Send email verification link."""
    verify_link = f"{BACKEND_BASE_URL}/verify-email?token={token}"

    html = f"""
    <h2>Welcome to MusicRec 🎵</h2>
    <p>Please verify your email by clicking the button below:</p>
    <p><a href="{verify_link}">Verify my account</a></p>
    <p>If the button doesn't work, open this link manually:</p>
    <p>{verify_link}</p>
    <hr/>
    <p>If you did not sign up for MusicRec, ignore this email.</p>
    """

    _send_email(to_email, "Verify your MusicRec account", html)


def send_password_reset_email(to_email: str, token: str) -> None:
    """Send password reset link → FRONTEND PAGE."""
    reset_link = f"{FRONTEND_BASE_URL}/reset-password?token={token}"

    html = f"""
    <h2>Reset your MusicRec password 🔐</h2>
    <p>Click the button below to reset your password:</p>
    <p><a href="{reset_link}">Reset password</a></p>
    <p>If the button doesn't work, manually open:</p>
    <p>{reset_link}</p>
    <hr/>
    <p>If you did not request a reset, ignore this email.</p>
    """

    _send_email(to_email, "Reset your MusicRec password", html)
