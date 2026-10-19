Rails.application.routes.draw do
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  get "/sitemap.xml", to: "seo#sitemap", defaults: { format: :xml }, as: :sitemap
  get "/robots.txt", to: "seo#robots", defaults: { format: :text }

  scope "(:locale)", locale: /zh/ do
    root "home#index"
    get "/learn", to: "learn#index", as: :learn
    get "/learn/position", to: "lessons#position", as: :position_lesson
    get "/learn/pot-odds", to: "lessons#pot_odds", as: :pot_odds_lesson
    get "/learn/decision-quality", to: "lessons#decision_quality", as: :decision_quality_lesson
    get "/practice", to: "practice#index"
    get "/methodology", to: "methodology#show"
    get "/privacy", to: "privacy#show", as: :privacy
    get "/sign-up", to: "registrations#new", as: :new_registration
    post "/sign-up", to: "registrations#create", as: :registration
    get "/sign-in", to: "sessions#new", as: :new_session
    post "/sign-in", to: "sessions#create", as: :session
    delete "/sign-in", to: "sessions#destroy"
    get "/settings/profile", to: "settings/profiles#show", as: :profile_settings
    patch "/settings/profile", to: "settings/profiles#update"
    delete "/settings/profile", to: "settings/profiles#destroy"
    get "/settings/profile/export", to: "settings/profiles#export", as: :profile_export
    resources :passwords, only: %i[new create edit update], param: :token
  end

  if Rails.env.development? || Rails.env.test?
    get "/content/registry", to: "content/registry#index", as: :content_registry
  end

  namespace :api do
    namespace :v1 do
      post "/imports/local_progress", to: "imports#local_progress", as: :local_progress_import
    end
  end

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check

  # Render dynamic PWA files from app/views/pwa/* (remember to link manifest in application.html.erb)
  # get "manifest" => "rails/pwa#manifest", as: :pwa_manifest
  # get "service-worker" => "rails/pwa#service_worker", as: :pwa_service_worker

  # Defines the root path route ("/")
  # root "posts#index"
end
