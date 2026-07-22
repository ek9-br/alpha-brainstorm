import {describe,expect,it} from 'vitest';import {canTransition} from './transitions';
describe('transições',()=>{it('aceita fluxo válido',()=>expect(canTransition('WAITING','PRESENTING')).toBe(true));it('impede participante de pular etapa',()=>expect(canTransition('WAITING','RESULTS')).toBe(false))});
