export const PASSWORD_MIN_LENGTH = 10;

export function getPasswordPolicyError(password) {
  if (password.length < PASSWORD_MIN_LENGTH) return "La password deve contenere almeno 10 caratteri.";
  if (!/[A-Z]/.test(password)) return "La password deve contenere almeno una lettera maiuscola.";
  if (!/[a-z]/.test(password)) return "La password deve contenere almeno una lettera minuscola.";
  if (!/[0-9]/.test(password)) return "La password deve contenere almeno un numero.";
  return "";
}