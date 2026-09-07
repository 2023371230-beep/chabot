/**
 * Reglas que sostienen la separacion front/back.
 *
 * En JavaScript y no en JSON a proposito: una regla sin su motivo se borra el
 * dia que estorba. Aqui el motivo vive al lado de la regla.
 */
module.exports = {
  extends: ['next/core-web-vitals'],
  overrides: [
    {
      /**
       * El front no puede tocar el back.
       *
       * Sin esta regla la separacion de carpetas es una costumbre, y las
       * costumbres se rompen el dia con prisa. Basta UN import para arrastrar
       * `server/database` — y con el la llave `service_role` de Supabase, la
       * que salta RLS — al paquete que viaja al navegador. Aqui el build falla
       * antes de que eso pueda pasar.
       */
      files: ['client/**/*.ts', 'client/**/*.tsx', 'app/**/page.tsx', 'app/**/layout.tsx'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['@/server/*', '**/server/*'],
                message:
                  'El front no importa del servidor. Habla con el por app/api/, usando client/lib/api. Si el dato que necesitas no tiene endpoint, crea el route.ts.'
              }
            ]
          }
        ]
      }
    },
    {
      /**
       * Y el back no puede depender del front.
       *
       * Lo que de verdad usen los dos lados va en `shared/`, y tiene que ser
       * puro: sin Supabase, sin React y sin `window`. Un modulo compartido que
       * arrastra cualquiera de esas tres deja de poder correr en el otro lado.
       */
      files: ['server/**/*.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['@/client/*', '**/client/*'],
                message:
                  'El servidor no importa del front. Si algo lo usan los dos lados, muevelo a shared/ y dejalo puro.'
              }
            ]
          }
        ]
      }
    }
  ]
};
