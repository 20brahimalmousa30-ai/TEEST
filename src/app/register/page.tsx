"use client";
import { useEffect } from "react";
import { RegisterExperience } from "./RegisterExperience";

export default function RegisterPage() {
  useEffect(() => { document.title = "التسجيل — معالي أبها"; }, []);
  return <RegisterExperience />;
}
