import {describe,expect,it} from 'vitest';
import {clampMindMapZoom} from './AdminMindMap';

describe('zoom do mapa mental',()=>{
 it('mantém o zoom dentro dos limites seguros',()=>{
  expect(clampMindMapZoom(.01)).toBe(.2);
  expect(clampMindMapZoom(3)).toBe(1.5);
  expect(clampMindMapZoom(.8)).toBe(.8)
 });

 it('recupera um zoom inválido sem apagar o mapa',()=>{
  expect(clampMindMapZoom(Number.NaN)).toBe(.72);
  expect(clampMindMapZoom(Number.POSITIVE_INFINITY)).toBe(.72)
 })
});
