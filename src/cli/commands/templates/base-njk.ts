/**
 * Base template for all pages
 */
export const baseNjk = String.raw`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{% block title %}{{ site.title }}{% endblock %}</title>
  <meta name="description" content="{% block description %}{{ site.description }}{% endblock %}">
  <link rel="stylesheet" href="/css/style.css">
  {% block head %}{% endblock %}
</head>
<body>
  <header>
    <div class="container">
      <h1><a href="/">{{ site.title }}</a></h1>
      <nav>
        <ul>
          <li><a href="/">Home</a></li>
          <li><a href="/tags/">Tags</a></li>
        </ul>
      </nav>
    </div>
  </header>

  <main class="container">
    {% block content %}{% endblock %}
  </main>

  <footer>
    <div class="container">
      <p>&copy; {{ "now" | date("YYYY") }} {{ site.title }}</p>
    </div>
  </footer>
</body>
</html>`;
