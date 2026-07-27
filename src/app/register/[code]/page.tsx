"use client";
import { useEffect } from "react";
import { RegisterExperience } from "../RegisterExperience";

/** Vanity public link, e.g. /register/1448. The code segment is a friendly
 *  edition label; the form itself is shared with /register and reflects the
 *  Prince-controlled active fields. */
export default function RegisterCodePage() {
  useEffect(() => { document.title = "التسجيل — معالي محافظة بلّسمر"; }, []);
  return <RegisterExperience />;
}
