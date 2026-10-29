/** Regras de nome de jogador (usadas no cliente E no servidor). */
export function validName(name: string): string | null {
  const n = name.trim();
  if (n.length < 3) return 'O nome precisa de pelo menos 3 letras.';
  if (n.length > 16) return 'Máximo de 16 caracteres.';
  if (!/^[\p{L}\p{N}_ .-]+$/u.test(n)) return 'Use só letras, números, espaço, ponto, _ ou -.';
  return null;
}
