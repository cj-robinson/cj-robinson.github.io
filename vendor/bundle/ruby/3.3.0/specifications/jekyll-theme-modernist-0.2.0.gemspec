# -*- encoding: utf-8 -*-
# stub: jekyll-theme-modernist 0.2.0 ruby lib

Gem::Specification.new do |s|
  s.name = "jekyll-theme-modernist".freeze
  s.version = "0.2.0".freeze

  s.required_rubygems_version = Gem::Requirement.new(">= 0".freeze) if s.respond_to? :required_rubygems_version=
  s.require_paths = ["lib".freeze]
  s.authors = ["Steve Smith".freeze, "GitHub, Inc.".freeze]
  s.date = "2021-07-29"
  s.email = ["opensource+jekyll-theme-modernist@github.com".freeze]
  s.homepage = "https://github.com/pages-themes/modernist".freeze
  s.licenses = ["CC0-1.0".freeze]
  s.required_ruby_version = Gem::Requirement.new(">= 2.4.0".freeze)
  s.rubygems_version = "3.5.4".freeze
  s.summary = "Modernist is a Jekyll theme for GitHub Pages".freeze

  s.installed_by_version = "3.5.4".freeze if s.respond_to? :installed_by_version

  s.specification_version = 4

  s.add_runtime_dependency(%q<jekyll>.freeze, ["> 3.5".freeze, "< 5.0".freeze])
  s.add_runtime_dependency(%q<jekyll-seo-tag>.freeze, ["~> 2.0".freeze])
  s.add_development_dependency(%q<html-proofer>.freeze, ["~> 3.0".freeze])
  s.add_development_dependency(%q<rubocop-github>.freeze, ["~> 0.16".freeze])
  s.add_development_dependency(%q<w3c_validators>.freeze, ["~> 1.3".freeze])
end