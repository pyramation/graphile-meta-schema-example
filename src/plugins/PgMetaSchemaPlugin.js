import { makeExtendSchemaPlugin, gql } from 'graphile-utils';

export default makeExtendSchemaPlugin((build, schemaOptions) => {
  /** @type {import('graphile-build-pg').PgIntrospectionResultsByKind} */
  const introspection = build.pgIntrospectionResultsByKind;

  // console.log(schemaOptions.pgSchemas);

  /** @type {string[]} */
  const schemas = schemaOptions.pgSchemas;

  // r = ordinary table, i = index, S = sequence, t = TOAST table, v = view, m = materialized view, c = composite type, f = foreign table, p = partitioned table, I = partitioned index

  return {
    typeDefs: gql`
      type MetaschemaType {
        name: String!
      }
      type MetaschemaField {
        name: String!
        type: MetaschemaType!
      }
      type MetaschemaTable {
        name: String!
        fields: [MetaschemaField]
        constraints: [MetaschemaConstraint]
      }

      union MetaschemaConstraint =
          MetaschemaForeignKeyConstraint
        | MetaschemaUniqueConstraint
        | MetaschemaPrimaryKeyConstraint
        | MetaschemaCheckConstraint
        | MetaschemaExclusionConstraint

      type MetaschemaForeignKeyConstraint {
        name: String!
        fields: [MetaschemaField]
        refTable: MetaschemaTable
        refFields: [MetaschemaField]
      }
      type MetaschemaUniqueConstraint {
        name: String!
        fields: [String]
      }
      type MetaschemaPrimaryKeyConstraint {
        name: String!
        fields: [MetaschemaField]
      }
      type MetaschemaCheckConstraint {
        name: String!
      }
      type MetaschemaExclusionConstraint {
        name: String!
      }

      type Metaschema {
        tables: [MetaschemaTable]
      }
      extend type Query {
        _meta: Metaschema
      }
    `,
    resolvers: {
      MetaschemaPrimaryKeyConstraint: {
        /** @param constraint {import('graphile-build-pg').PgConstraint} */
        fields(constraint) {
          return constraint.keyAttributes;
        }
      },
      MetaschemaForeignKeyConstraint: {
        /** @param constraint {import('graphile-build-pg').PgConstraint} */
        fields(constraint) {
          return constraint.keyAttributes;
        },
        /** @param constraint {import('graphile-build-pg').PgConstraint} */
        refTable(constraint) {
          return constraint.foreignClass;
        },
        /** @param constraint {import('graphile-build-pg').PgConstraint} */
        refFields(constraint) {
          return constraint.foreignKeyAttributes;
        }
      },
      MetaschemaField: {
        /** @param attr {import('graphile-build-pg').PgAttribute} */
        type(attr) {
          return attr.type;
        }
      },
      MetaschemaTable: {
        /** @param table {import('graphile-build-pg').PgClass} */
        fields(table) {
          return table.attributes.filter(attr => {
            if (attr.num < 1) return false; // low-level props
            return true;
          });
        },
        /** @param table {import('graphile-build-pg').PgClass} */
        constraints(table) {
          return table.constraints;
        }
      },
      MetaschemaConstraint: {
        /** @param obj {import('graphile-build-pg').PgConstraint} */
        __resolveType(obj) {
          switch (obj.type) {
            case 'p':
              return 'MetaschemaPrimaryKeyConstraint';
            case 'f':
              return 'MetaschemaForeignKeyConstraint';
            case 'c':
              return 'MetaschemaCheckConstraint';
            case 'u':
              return 'MetaschemaUniqueConstraint';
            case 'x':
              return 'MetaschemaExclusionConstraint';
          }
        }
      },
      Metaschema: {
        tables() {
          return introspection.class.filter(kls => {
            if (!schemas.includes(kls.namespaceName)) return false;
            if (kls.classKind !== 'r') return false; // relation (tables)
            return true;
          });
        }
      },
      Query: {
        _meta() {
          // just placeholder
          return {};
        }
      }
    }
  };
});
