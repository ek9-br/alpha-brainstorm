// @vitest-environment jsdom
import {beforeEach,describe,expect,it} from 'vitest';import {restoreParticipant,saveParticipant} from './storage';
describe('participante',()=>{beforeEach(()=>localStorage.clear());it('restaura UUID válido',()=>{const id='123e4567-e89b-12d3-a456-426614174000';saveParticipant('DEMO',id);expect(restoreParticipant('DEMO')).toBe(id)});it('ignora valor inválido',()=>{localStorage.setItem('brainstorm:DEMO:participant','x');expect(restoreParticipant('DEMO')).toBeNull()})});
