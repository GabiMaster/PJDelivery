const recipes = [
  [/^Milanesa en Pan Baguette/, 'Milanesa, lechuga, tomate y mayonesa.'],
  [/^Milanesa a la Napolitana/, 'Milanesa de carne, salsa, queso, jamón, papas fritas y huevo.'],
  [/^Milanesa a Caballo/, 'Milanesa de carne, huevo frito y papas fritas.'],
  [/^Milanesa Cheddar y Panceta/, 'Milanesa de carne, queso cheddar, panceta, huevo frito y papas fritas.'],
  [/^Sándwich Cheddar y Panceta en Pan Baguette/, 'Mayonesa, lechuga, tomate, milanesa de carne, jamón, queso cheddar, panceta y huevo.'],
  [/^Miga Simple Jamón y Queso$/, 'Dos migas con jamón, queso y mayonesa (frío o tostado).'],
  [/^Miga Triple Jamón y Queso$/, 'Tres migas con jamón, queso y mayonesa (frío o tostado).'],
  [/^Miga Triple de Verdura$/, 'Tres migas con jamón, queso, lechuga, tomate, huevo, ají, morrón y mayonesa.'],
  [/^Miga Triple de Lomo$/, 'Tres migas con jamón, queso, carne de lomo, huevo rallado, lechuga, tomate, morrón, ají y mayonesa.'],
  [/^Miga Psicodélico/, 'Tres migas con jamón, queso, carne de lomo, huevo rallado, lechuga, tomate, morrón, ají y mayonesa, gratinado con queso.'],
  [/^Hamburguesa Común$/, 'Pan de hamburguesa, medallón de carne, queso, lechuga, tomate y mayonesa.'],
  [/^Hamburguesa Completa$/, 'Pan de hamburguesa, medallón de carne, queso, huevo, paleta, lechuga, tomate y mayonesa.'],
  [/^Hamburguesa Mac$/, 'Pan de hamburguesa, medallón de carne, queso, paleta, lechuga, tomate, mayonesa, morrón, ají y cebolla caramelizada.'],
  [/^Hamburguesa Supermac$/, 'Pan de hamburguesa, medallón de carne, queso, paleta, lechuga, tomate, mayonesa, morrón, ají, cebolla caramelizada, queso cheddar y panceta.'],
  [/^Hamburguesa Cheddar y Panceta$/, 'Pan de hamburguesa, medallón de carne, queso cheddar, panceta, lechuga, tomate y mayonesa.'],
  [/^Adicional Hamburguesa \(Medallón y Queso\)$/, 'Medallón de carne y queso.'],
  [/^Pizza Muzzarella -/, 'Salsa de tomate, muzzarella, aceitunas y orégano.'],
  [/^Pizza Muzzarella con Morrones -/, 'Salsa de tomate, muzzarella, morrón, aceitunas y orégano.'],
  [/^Pizza Muzzarella con Verdeo -/, 'Salsa de tomate, muzzarella, verdeo, orégano y cebolla de verdeo.'],
  [/^Pizza Muzzarella con Panceta y Verdeo -/, 'Salsa de tomate, muzzarella, aceitunas, orégano, cebolla de verdeo y panceta.'],
  [/^Pizza Especial con Jamón -/, 'Salsa de tomate, muzzarella, jamón, aceitunas y orégano.'],
  [/^Pizza Especial con Jamón y Huevo -/, 'Salsa de tomate, muzzarella, jamón, huevo duro rallado, aceitunas y orégano.'],
  [/^Pizza Calabresa -/, 'Salsa de tomate, muzzarella, rodajas de longaniza, aceitunas y orégano.'],
  [/^Pizza Napolitana -/, 'Salsa de tomate, muzzarella, rodajas de tomate, aceitunas y orégano.'],
  [/^Pizza Napolitana a la Calabresa -/, 'Salsa de tomate, muzzarella, rodajas de tomate, rodajas de longaniza, aceitunas y orégano.'],
  [/^Pizza Rúcula con Jamón -/, 'Salsa de tomate, muzzarella, jamón, hojas de rúcula, provolone rallado, aceite de oliva y aceitunas.'],
  [/^Pizza Palmitos -/, 'Salsa de tomate, muzzarella, jamón, palmitos, ají, morrón, salsa golf, aceitunas y orégano.'],
  [/^Pizza Tomate con Provolone -/, 'Salsa de tomate, muzzarella, rodajas de tomate, provolone rallado, aceitunas y orégano.'],
  [/^Pizza Jamón y Champiñones -/, 'Salsa de tomate, muzzarella, jamón, champiñones, cebolla, aceite de oliva, aceitunas y orégano.'],
  [/^Pizza Fugazzeta -/, 'Cebolla, muzzarella, aceitunas y orégano.'],
  [/^Pizza Roquefort -/, 'Salsa de tomate, muzzarella, queso roquefort, aceitunas y orégano.'],
  [/^Pizza Provenzal -/, 'Salsa de tomate, muzzarella, perejil, ajo, aceitunas y orégano.'],
  [/^Pizza Anchoas -/, 'Salsa de tomate, muzzarella, anchoas, aceitunas y orégano.'],
  [/^Pizza 4 Quesos -/, 'Salsa de tomate, muzzarella, sardo, provolone y roquefort.'],
  [/^Pizza 4 Estaciones -/, 'Especial, napolitana, especial con huevo, fugazzetta, aceitunas y orégano.'],
  [/^Pizza Mac -/, 'Salsa de tomate, muzzarella, jamón, huevo frito, morrón, ají y aceitunas.'],
  [/^Pizza Súper Mac -/, 'Salsa de tomate, muzzarella, cebolla, carne de lomo en tiras, champiñones, verdeo, perejil, provolone, orégano y huevo frito.']
];

const lomoRecipes = {
  Simple: 'Bife de lomo, queso, lechuga, tomate y mayonesa.',
  Completo: 'Bife de lomo, queso, paleta, huevo, lechuga, tomate, mayonesa, ají y morrón.',
  Mac: 'Bife de lomo, queso, paleta, huevo, lechuga, tomate, mayonesa, ají, morrón y cebolla caramelizada.',
  'Cheddar y Panceta': 'Bife de lomo, queso cheddar, panceta, huevo, lechuga, tomate y mayonesa.'
};

export function ingredientsFor(name) {
  const value = String(name || '').trim();
  const lomo = value.match(/^Lomo (Simple|Completo|Mac|Cheddar y Panceta) - (.+)$/);
  if (lomo) {
    const bread = lomo[2] === 'Pan de Hamburguesa' ? 'Pan de hamburguesa' : 'Pan meguete';
    return `${bread}, ${lomoRecipes[lomo[1]].charAt(0).toLowerCase()}${lomoRecipes[lomo[1]].slice(1)}`;
  }
  return recipes.find(([pattern]) => pattern.test(value))?.[1] || null;
}
