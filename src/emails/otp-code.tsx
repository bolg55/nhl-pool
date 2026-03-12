import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface OtpCodeEmailProps {
  otp: string;
}

export function OtpCodeEmail({ otp }: OtpCodeEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your NHL Pool sign-in code: {otp}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>NHL Pool</Heading>
          <Text style={paragraph}>Your sign-in code is:</Text>
          <Section style={codeContainer}>
            <Text style={code}>{otp}</Text>
          </Section>
          <Text style={footnote}>
            This code expires in 5 minutes. If you didn't request this, you can safely ignore this
            email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const body = {
  backgroundColor: "#ffffff",
  fontFamily: "system-ui, -apple-system, sans-serif",
};

const container = {
  margin: "0 auto",
  padding: "20px",
  maxWidth: "400px",
};

const heading = {
  fontSize: "24px",
  fontWeight: "bold" as const,
  marginBottom: "4px",
};

const paragraph = {
  fontSize: "16px",
  color: "#333333",
};

const codeContainer = {
  background: "#f4f4f5",
  borderRadius: "8px",
  padding: "16px",
  textAlign: "center" as const,
};

const code = {
  fontSize: "32px",
  fontWeight: "bold" as const,
  letterSpacing: "4px",
  margin: "0",
};

const footnote = {
  color: "#71717a",
  fontSize: "14px",
  marginTop: "16px",
};
