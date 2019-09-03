const path = require(`path`);
const crypto = require(`crypto`);
const { createFilePath } = require(`gatsby-source-filesystem`);
const config = require('./config');

const toKebabCase = str =>
  str &&
  str
    .match(/[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g)
    .map(x => x.toLowerCase())
    .join('-');

exports.createPages = ({ graphql, actions }) => {
  const { createPage } = actions;

  const snippetPage = path.resolve(`./src/docs/templates/SnippetPage.js`);
  const tagPage = path.resolve(`./src/docs/templates/TagPage.js`);
  return graphql(
    `
      {
        allMarkdownRemark(
          sort: { fields: [frontmatter___title], order: ASC }
          limit: 1000
        ) {
          edges {
            node {
              fields {
                slug
              }
              frontmatter {
                tags
              }
              fileAbsolutePath
            }
          }
        }
      }
    `,
  ).then(result => {
    if (result.errors) {
      throw result.errors;
    }

    // Create individual snippet pages.
    const snippets = result.data.allMarkdownRemark.edges;

    snippets.forEach((post, index) => {
      if(post.node.fileAbsolutePath.indexOf('README') !== -1)
        return;
      if (post.node.fileAbsolutePath.indexOf(config.snippetArchivePath) === -1)
        createPage({
          path: `/snippet${post.node.fields.slug}`,
          component: snippetPage,
          context: {
            slug: post.node.fields.slug,
            scope: `./snippets`,
          },
        });
      else
        createPage({
          path: `/archive${post.node.fields.slug}`,
          component: snippetPage,
          context: {
            slug: post.node.fields.slug,
            scope: `./snippets_archive`,
          },
        });
    });

    // Create tag pages.
    const tags = snippets.reduce((acc, post) => {
      if (!post.node.frontmatter || !post.node.frontmatter.tags) return acc;
      const primaryTag = post.node.frontmatter.tags.split(',')[0];
      if (!acc.includes(primaryTag)) acc.push(primaryTag);
      return acc;
    }, []);

    tags.forEach(tag => {
      const tagPath = `/tag/${toKebabCase(tag)}/`;
      const tagRegex = `/^\\s*${tag}/`;
      createPage({
        path: tagPath,
        component: tagPage,
        context: {
          tag,
          tagRegex,
        },
      });
    });

    createPage({
      path: `/beginner`,
      component: tagPage,
      context: {
        tag: `beginner snippets`,
        tagRegex: `/beginner/`,
      },
    });

    return null;
  });
};

exports.onCreateNode = ({ node, actions, getNode }) => {
  const { createNodeField } = actions;

  if (node.internal.type === `MarkdownRemark`) {
    const value = createFilePath({ node, getNode });
    createNodeField({
      name: `slug`,
      node,
      value,
    });
  }
};

exports.createSchemaCustomization = ({ actions }) => {
  const { createTypes } = actions;

  const typeDefs = `
    type Snippet implements Node @dontInfer {
      title: String,
      html: String,
      tags: [String],
      id: String
    }
  `
  createTypes(typeDefs);
};

exports.sourceNodes = ({ graphql, actions, createNodeId, createContentDigest, getNode, getNodes, getNodesByType }) => {
  const { createNode } = actions;

  const allMarkdownRemark = getNodesByType('MarkdownRemark');
  const allSnippetDataJson = getNodesByType('SnippetDataJson').filter(v => v.meta.scope === `./${config.snippetPath}`)[0];
  const allSnippetArchiveDataJson = getNodesByType('SnippetDataJson').filter(v => v.meta.scope === `./${config.snippetArchivePath}`)[0];

  console.log(allMarkdownRemark[1])

  const snippets = allSnippetDataJson.data.map(snippet => ({
    title: snippet.title,
    html: allMarkdownRemark.find(
      v => v.frontmatter.title === snippet.title,
    ).html,
    tags: snippet.attributes.tags,
    id: snippet.id,
  }));

  snippets.forEach(snippet => {
    createNode({
      id: createNodeId(`snp-${snippet.id}`),
      parent: null,
      children: [],
      internal: {
        type: `Snippet`,
        contentDigest: createContentDigest(snippet)
      },
      title: snippet.title,
      html: snippet.html,
      tags: snippet.tags,
    });
  })
};
