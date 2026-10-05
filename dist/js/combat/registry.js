// Registro central de definições. Os módulos de dados se registram aqui ao carregar,
// e o motor de combate consulta o registro (evita importações circulares).
export const REG = {
  enemies: {},   // id -> definição de inimigo/chefe
  skills: {},    // id -> habilidade do herói
  relics: {},    // id -> relíquia
  items: {},     // id -> consumível
  suits: {},     // id -> traje
  classes: {},   // id -> ofício
  weapons: {},   // id -> arma
  statuses: {},  // id -> descrição de estado
};

export function register(kind, defs) {
  for (const [id, d] of Object.entries(defs)) {
    d.id = id;
    REG[kind][id] = d;
  }
}
