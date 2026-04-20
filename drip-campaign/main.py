def send_email(to_email: str, subject: str, body: str):
    gmail_user = os.environ["GMAIL_USER"]
    gmail_password = os.environ["GMAIL_APP_PASSWORD"]

    to_email = clean(to_email).replace(' ', '')
    subject = clean(subject)
    body = body.encode('ascii', 'xmlcharrefreplace').decode('ascii')

    msg = MIMEMultipart("alternative")
    msg["Subject"] = Header(subject, "utf-8")
    msg["From"] = gmail_user
    msg["To"] = to_email
    msg.attach(MIMEText(body, "html"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
        smtp.login(gmail_user, gmail_password)
        smtp.sendmail(gmail_user, to_email, msg.as_string())
