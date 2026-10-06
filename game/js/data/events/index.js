// Agregador de TODOS os eventos (Área E). quests.js e story.js são da Área D (mesmo formato).
import fieldR1 from './field_r1.js';
import fieldR2 from './field_r2.js';
import fieldR3 from './field_r3.js';
import fieldR4 from './field_r4.js';
import fieldR5 from './field_r5.js';
import fieldAny from './field_any.js';
import fieldDeep from './field_deep.js';
import camp from './camp.js';
import night from './night.js';
import city from './city.js';
import ruin from './ruin.js';
import shrine from './shrine.js';
import quests from './quests.js';
import story from './story.js';

const asList = (x) => (Array.isArray(x) ? x : (x && Array.isArray(x.default) ? x.default : []));

export const EVENT_SOURCES = {
  field_r1: fieldR1, field_r2: fieldR2, field_r3: fieldR3, field_r4: fieldR4, field_r5: fieldR5, field_any: fieldAny, field_deep: fieldDeep,
  camp, night, city, ruin, shrine, quests, story,
};

export const EVENTS = Object.values(EVENT_SOURCES).flatMap(asList).filter((e) => e && e.id);
export const EVENT_BY_ID = Object.fromEntries(EVENTS.map((e) => [e.id, e]));
export default EVENTS;
